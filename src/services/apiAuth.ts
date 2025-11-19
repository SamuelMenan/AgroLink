// Cliente mínimo para endpoints de autenticación del backend.
// Stores tokens locally and decodes basic user information.

export type AuthTokens = { access_token: string; refresh_token: string; expires_in?: number; token_type?: string };
export type BackendAuthResponse = AuthTokens & { user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } };

const ACCESS_KEY = 'agrolink_access_token';
const REFRESH_KEY = 'agrolink_refresh_token';

export function getAccessToken() { return localStorage.getItem(ACCESS_KEY) || null; }
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY) || null; }
export function setTokens(t: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, t.access_token);
  localStorage.setItem(REFRESH_KEY, t.refresh_token);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function decodeJwtPayload(token: string): unknown {
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return {}; }
}

export type AuthUser = { id: string; email?: string; full_name?: string; phone?: string };

export function deriveUserFromTokens(resp: BackendAuthResponse): AuthUser | null {
  const token = resp.access_token;
  if (!token) return null;
  const payloadRaw = decodeJwtPayload(token);
  const payload = (typeof payloadRaw === 'object' && payloadRaw !== null) ? payloadRaw as Record<string, unknown> : {};
  const userMetaSource = resp.user?.user_metadata || (payload['user_metadata'] as Record<string, unknown> | undefined) || {};
  const userMeta = userMetaSource as { full_name?: string; name?: string; phone?: string };
  return {
    id: resp.user?.id || (payload['sub'] as string | undefined) || (payload['user_id'] as string | undefined) || '',
    email: resp.user?.email || (payload['email'] as string | undefined) || undefined,
    full_name: userMeta.full_name || userMeta.name || undefined,
    phone: userMeta.phone || undefined,
  };
}

type PostBody = Record<string, unknown>

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const merged: RequestInit = { ...init, signal: controller.signal }
  return fetch(input, merged).finally(() => clearTimeout(id))
}

async function post(path: string, body: PostBody): Promise<BackendAuthResponse> {
  // Compute URLs: proxy (relative, same-origin via Vercel rewrite), direct (absolute)
  const proxiedPath = path.startsWith('/api/proxy') ? path : (path.startsWith('/') ? `/api/proxy${path}` : `/api/proxy/${path}`);
  const proxyUrl = proxiedPath;
  const directUrl = /^https?:\/\//i.test(path) ? path : `${BASE_URL}${path}`;

  // In PROD and cross-origin, force proxy-only to avoid CORS/gateway errors
  const prodProxyOnly = (() => {
    try {
      if (import.meta.env.PROD && typeof window !== 'undefined') {
        const base = new URL(BASE_URL);
        return base.origin !== window.location.origin;
      }
    } catch { /* ignore */ }
    return false;
  })();

  const maxRetries = 3;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // try primary (proxy in PROD when cross-origin)
    try {
      const primary = prodProxyOnly ? proxyUrl : proxyUrl;
      let res = await fetchWithTimeout(primary, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 6000);
      // On gateway errors, optionally try direct host within same attempt (only when not cross-origin)
      if (!res.ok && [502, 503, 504].includes(res.status) && !prodProxyOnly) {
        try {
          res = await fetchWithTimeout(directUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 6000)
        } catch { /* ignore secondary network error */ }
      }
      const text = await res.text();
      if (!res.ok) {
        if ([502, 503, 504].includes(res.status) && attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 400 * (attempt + 1))); continue; }
        try {
          const json = JSON.parse(text);
          const detail = (json.error && (json.error.message || json.error.code)) || (json.message as string | undefined) || text;
          throw new Error(`Auth ${res.status}: ${detail}`);
        } catch {
          throw new Error(`Auth ${res.status}: ${text}`);
        }
      }
      return JSON.parse(text);
    } catch {
      // On network error, retry primary only (proxy-only in PROD)
      lastError = new Error('Network error');
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Auth request failed');
}

const AUTH_PREFIX = '/api/v1/auth'; // centralizado para evitar duplicaciones y errores al versionar

// Llamada directa a Supabase como último recurso para refrescar tokens.
async function supabaseRefreshFallback(refresh_token: string): Promise<BackendAuthResponse> {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const SUPABASE_URL: string | undefined = env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY: string | undefined = env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase fallback not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }

  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ refresh_token }),
  });

  const text = await res.text();
  if (!res.ok) {
    try {
      const json = JSON.parse(text);
      const detail = (json.error && (json.error.message || json.error.code)) || json.message || text;
      throw new Error(`Supabase ${res.status}: ${detail}`);
    } catch {
      throw new Error(`Supabase ${res.status}: ${text}`);
    }
  }

  return JSON.parse(text) as BackendAuthResponse;
}

export async function signUp(fullName: string, email: string, password: string, phone?: string) {
  const resp = await post(`${AUTH_PREFIX}/sign-up`, { email, password, data: { full_name: fullName, phone } });
  if (resp.access_token && resp.refresh_token) setTokens(resp);
  return resp;
}

export async function signInEmail(email: string, password: string) {
  const resp = await post(`${AUTH_PREFIX}/sign-in`, { email, password });
  if (resp.access_token && resp.refresh_token) setTokens(resp);
  return resp;
}

export async function signInPhone(phone: string, password: string) {
  const resp = await post(`${AUTH_PREFIX}/sign-in`, { phone, password });
  if (resp.access_token && resp.refresh_token) setTokens(resp);
  return resp;
}

export async function refreshSession() {
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');
  // Primero: intentar vía backend (directo/proxy con retry/backoff).
  try {
    const resp = await post(`${AUTH_PREFIX}/refresh`, { refresh_token: rt });
    if (resp.access_token && resp.refresh_token) setTokens(resp);
    return resp;
  } catch (primaryErr) {
    console.error('[apiAuth] refresh via backend failed', primaryErr)
    // Fallback final: invocar directamente a Supabase si se configuraron variables en frontend
    try {
      const supabaseResp = await supabaseRefreshFallback(rt);
      if (supabaseResp.access_token && supabaseResp.refresh_token) setTokens(supabaseResp);
      console.info('[apiAuth] refreshSession: usado fallback directo a Supabase');
      return supabaseResp;
    } catch (fallbackErr) {
      console.error('[apiAuth] Supabase fallback failed', fallbackErr);
      // Si el fallback también falla, devolver el error original con detalle del fallback
      const combined = new Error(
        `Refresh failed via backend: ${(primaryErr as Error).message}. Fallback to Supabase failed: ${(fallbackErr as Error).message}`
      );
      throw combined;
    }
  }
}

export function signOut() { clearTokens(); }

// Determinar backend base URL
const resolveBaseUrl = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const envBackend = import.meta.env.VITE_BACKEND_URL;

  if (import.meta.env.PROD) {
    // En producción: intento directo a backend (VITE_BACKEND_URL) y fallback relativo si falla.
    const effective = envBackend || origin;
    console.info('[apiAuth] ENV PROD. BASE_URL directo =', effective, 'VITE_BACKEND_URL =', envBackend, 'origin =', origin);
    return effective;
  }

  const effective = envBackend || 'http://localhost:8080';
  console.info('[apiAuth] ENV DEV. VITE_BACKEND_URL =', envBackend, 'BASE_URL =', effective);
  return effective;
};

const BASE_URL = resolveBaseUrl();

export const getOAuthStartUrl = (provider: string, next: string) =>
  `${BASE_URL}/api/v1/auth/oauth/start?provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;
