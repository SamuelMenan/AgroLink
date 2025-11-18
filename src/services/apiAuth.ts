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
async function post(path: string, body: PostBody): Promise<BackendAuthResponse> {
  // Primary: call backend host directly; Fallback: same-origin (Vercel rewrite)
  const primaryUrl = /^https?:\/\//i.test(path) ? path : `${BASE_URL}${path}`;
  const fallbackUrl = path; // relative -> goes via Vercel proxy in prod
  const maxRetries = 3;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let res = await fetch(primaryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      // If CORS/proxy/cold-start fails, try fallback once per attempt in PROD
      if (!res.ok && import.meta.env.PROD && !/^https?:\/\//i.test(path)) {
        if ([502, 503, 504].includes(res.status)) {
          // brief wait before trying fallback
          await new Promise(r => setTimeout(r, 150));
          res = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        }
      }
      const text = await res.text();
      if (!res.ok) {
        // Reintentos rápidos para errores de gateway/cold start
        if ([502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        try {
          const json = JSON.parse(text);
          const detail = (json.error && (json.error.message || json.error.code)) || json.message || text;
          throw new Error(`Auth ${res.status}: ${detail}`);
        } catch {
          throw new Error(`Auth ${res.status}: ${text}`);
        }
      }
      return JSON.parse(text);
    } catch (e) {
      // Network/CORS error before getting a Response
      if (import.meta.env.PROD && !/^https?:\/\//i.test(path)) {
        try {
          const res = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const text = await res.text();
          if (res.ok) return JSON.parse(text);
          if ([502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          try {
            const json = JSON.parse(text);
            const detail = (json.error && (json.error.message || json.error.code)) || json.message || text;
            throw new Error(`Auth ${res.status}: ${detail}`);
          } catch {
            throw new Error(`Auth ${res.status}: ${text}`);
          }
        } catch (fallbackErr) {
          lastError = fallbackErr;
        }
      } else {
        lastError = e;
      }
      // Reintentar en errores de red
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Auth request failed');
}

const AUTH_PREFIX = '/api/v1/auth'; // centralizado para evitar duplicaciones y errores al versionar

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
  const resp = await post(`${AUTH_PREFIX}/refresh`, { refresh_token: rt });
  if (resp.access_token && resp.refresh_token) setTokens(resp);
  return resp;
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
