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
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    // Intentar extraer mensaje estructurado de Supabase
    try {
      const json = JSON.parse(text);
      const detail = (json.error && (json.error.message || json.error.code)) || json.message || text;
      throw new Error(`Auth ${res.status}: ${detail}`);
    } catch {
      throw new Error(`Auth ${res.status}: ${text}`);
    }
  }
  return JSON.parse(text);
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
// - En producción: usar siempre VITE_BACKEND_URL si está definida;
//   si no, caer en window.location.origin para no generar rutas relativas.
// - En desarrollo: VITE_BACKEND_URL o localhost:8080.
const resolveBaseUrl = () => {
  // Solo acceder a window en entorno browser
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (import.meta.env.PROD) {
    return import.meta.env.VITE_BACKEND_URL || origin;
  }

  // Desarrollo
  return import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
};

const BASE_URL = resolveBaseUrl();

// Si backendBase está vacío usamos ruta relativa para que el proxy de Vite redirija al backend (solo en dev con proxy).
export const getOAuthStartUrl = (provider: string, next: string) =>
  `${BASE_URL}/api/v1/auth/oauth/start?provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;

// Endpoint mínimo para OAuth
export const getOAuthStartUrlFallback = (provider: string, next: string) =>
  `${BASE_URL}/api/v1/auth/oauth/start?provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;
