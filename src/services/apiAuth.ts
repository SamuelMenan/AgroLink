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
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const binary = atob(b64 + pad);
    const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
    let jsonStr: string;
    try {
      jsonStr = new TextDecoder('utf-8').decode(bytes);
    } catch {
      jsonStr = decodeURIComponent([...binary].map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    }
    return JSON.parse(jsonStr);
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

async function warmupProxy() {
  try {
    const isProd = import.meta.env.PROD
    const path = isProd ? '/api/proxy/actuator/health' : '/api/actuator/health'
    await fetch(path, { cache: 'no-store' })
    await new Promise(r => setTimeout(r, 200))
  } catch { /* ignore */ }
}

async function post(path: string, body: PostBody): Promise<BackendAuthResponse> {
  // Compute URLs: serverless (/api/*) stays same-origin; backend paths go via /api/proxy
  const isServerless = path.startsWith('/api/')
  const isProd = import.meta.env.PROD
  const proxiedPath = path.startsWith('/api/proxy') ? path : (isProd && !isServerless ? (path.startsWith('/') ? `/api/proxy${path}` : `/api/proxy/${path}`) : path)
  const proxyUrl = isServerless ? path : proxiedPath
  const directUrl = /^https?:\/\//i.test(path) ? path : `${BASE_URL}${path}`;

  // In PROD and cross-origin, force proxy-only to avoid CORS/gateway errors

  // Detectar sign-up para control de reintentos: permitimos reintento sólo en errores de infraestructura (502/503/504)
  const isSignUp = /\/sign-up$/.test(path)
  const maxRetries = isSignUp ? 2 : 2;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Primario: proxy same-origin
      let res = await fetchWithTimeout(proxyUrl, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
          'X-Attempt': String(attempt + 1),
          'X-Request-Type': 'proxy'
        }, 
        body: JSON.stringify(body) 
      }, 6000) // 6s timeout for auth ops (refresh goes direct to Supabase)
      if (!res.ok && [405, 502, 503, 504].includes(res.status)) {
        console.warn(`[apiAuth] Proxy failed with ${res.status}, attempting direct backend`, {
          endpoint: path,
          status: res.status,
          directUrl: directUrl,
          sameOrigin: (typeof window !== 'undefined') ? (new URL(BASE_URL).origin === window.location.origin) : true
        })
        
        const shouldAttemptDirect = res.status === 405 || (typeof window !== 'undefined' ? (new URL(BASE_URL).origin === window.location.origin) : true)
        
        if (shouldAttemptDirect) {
          try {
            console.log(`[apiAuth] Attempting direct fetch to: ${directUrl} (attempt ${attempt + 1})`)
            const directRes = await fetchWithTimeout(directUrl, { 
              method: 'POST', 
              headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json',
                'X-Attempt': String(attempt + 1),
                'X-Request-Type': 'direct',
                'X-Direct-Request': 'true'
              }, 
              body: JSON.stringify(body) 
            }, 10000) // Increased timeout to 10s for direct requests
            console.log(`[apiAuth] Direct fetch result: ${directRes.status} (attempt ${attempt + 1})`)
            if (directRes.ok || (directRes.status >= 400 && directRes.status < 500)) {
              res = directRes
            }
          } catch (directError) {
            console.error(`[apiAuth] Direct fetch failed (attempt ${attempt + 1}):`, directError)
            
            // Handle specific error types
            if (directError instanceof Error) {
              if (directError.name === 'AbortError') {
                console.warn(`[apiAuth] Request aborted (attempt ${attempt + 1}) - timeout or user cancellation`)
              } else if (directError.message.includes('CORS')) {
                console.warn(`[apiAuth] CORS error detected on direct fetch (attempt ${attempt + 1}) - expected for cross-origin`)
              } else if (directError.message.includes('Network')) {
                console.warn(`[apiAuth] Network error on direct fetch (attempt ${attempt + 1})`)
              }
            }
            
            // On last attempt, throw the direct error if we can't use the proxy response
            if (attempt === maxRetries - 1) {
              throw directError;
            }
            
            // Continue with original error for non-last attempts
            console.warn(`[apiAuth] Continuing with proxy response due to direct fetch failure (attempt ${attempt + 1})`)
          }
        } else {
          console.warn('[apiAuth] Skipping direct fetch - cross-origin detected and not a 405 error')
        }
      }
      const text = await res.text();
      if (!res.ok) {
        // For client errors (4xx), don't retry - propagate the error
        if (res.status >= 400 && res.status < 500) {
          try {
            const json = JSON.parse(text);
            
            // Special handling for 422 user already exists error
            if (res.status === 422 && json.error_code === 'user_already_exists') {
              throw new Error(`Auth ${res.status}: Este usuario ya está registrado. Por favor, inicia sesión o usa otro correo/teléfono.`);
            }
            
            const detail = (json.error && (json.error.message || json.error.code)) || (json.message as string | undefined) || text;
            const eid = (json.error_id as string | undefined);
            const suffix = eid ? ` (ID de error: ${eid})` : '';
            throw new Error(`Auth ${res.status}: ${detail}${suffix}`);
          } catch {
            // If JSON parsing fails, still provide meaningful error
            if (res.status === 422 && text.includes('user_already_exists')) {
              throw new Error(`Auth ${res.status}: Este usuario ya está registrado. Por favor, inicia sesión o usa otro correo/teléfono.`);
            }
            throw new Error(`Auth ${res.status}: ${text}`);
          }
        }
        
        // For server errors (5xx), throw to trigger retry
        if ([502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
          // Para sign-up: reintentar solo si es error de infraestructura (no duplicará creación; Supabase devolverá 422 en segundo intento si ya existe)
          console.log(`[apiAuth] Retry ${attempt + 1}/${maxRetries} after infra ${res.status} error (isSignUp=${isSignUp})`)
          throw new Error(`Server error ${res.status}: ${text}`);
        }
        
        // Último intento o otros 5xx: intentar extraer error_id para diagnóstico
        try {
          const json = JSON.parse(text);
          const detail = (json.error && (json.error.message || json.error.code)) || (json.message as string | undefined) || text;
          const eid = (json.error_id as string | undefined);
          const suffix = eid ? ` (ID de error: ${eid})` : '';
          throw new Error(`Server error ${res.status}: ${detail}${suffix}`);
        } catch {
          throw new Error(`Server error ${res.status}: ${text}`);
        }
      }
      
      return JSON.parse(text);
      
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isLastAttempt) {
        console.error(`[apiAuth] Final attempt failed for ${path}:`, err);
        
        // Provide more specific error messages
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            throw new Error('La solicitud tardó demasiado tiempo. Por favor, intenta nuevamente.');
          }
          if (err.message.includes('Network')) {
            throw new Error('Error de red. Por favor, verifica tu conexión a internet.');
          }
          if (err.message.includes('CORS')) {
            throw new Error('Error de conexión con el servidor. Por favor, intenta nuevamente en unos momentos.');
          }
        }
        
        throw err;
      }
      
      const delay = isSignUp ? 700 * (attempt + 1) : 500 * (attempt + 1); // Mayor backoff en sign-up para cold start backend
      console.warn(`[apiAuth] Attempt ${attempt + 1} failed for ${path}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError instanceof Error ? lastError : new Error('Auth request failed');
}

const AUTH_PREFIX = import.meta.env.DEV ? '/api/v1/auth' : '/api/proxy/api/v1/auth';

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

// Fallback directo a Supabase para sign-in por email o teléfono cuando el backend está caído/cold.
async function supabaseSignInFallback(params: { email?: string; phone?: string; password: string }): Promise<BackendAuthResponse> {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const SUPABASE_URL: string | undefined = env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY: string | undefined = env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase fallback not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }

  const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
  const payload: Record<string, unknown> = { password: params.password };
  if (params.email && params.email.trim()) payload.email = params.email;
  if (params.phone && params.phone.trim()) payload.phone = params.phone;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
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

function hasSupabaseEnv(): boolean {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
  return !!(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}

export async function signUp(fullName: string, email: string, password: string, phone?: string, captchaToken?: string) {
  // Support phone-only registration - backend will generate email if needed
  const basePayload: Record<string, unknown> = { password, data: { full_name: fullName } };
  const hasEmail = !!(email && email.trim());
  const hasPhone = !!(phone && phone.trim());
  const enableSignupCaptcha = !!import.meta.env.VITE_ENABLE_SIGNUP_CAPTCHA;

  if (hasEmail) basePayload.email = email.trim();
  if (hasPhone) basePayload.phone = phone!.trim();
  // Bypass temporal: omitir token de CAPTCHA durante registro salvo que se habilite explícitamente
  if (captchaToken && enableSignupCaptcha) basePayload[captchaFieldName()] = captchaToken;

  // Pre-warm proxy/backend (health) antes de intentar alta, mitigando 502 por cold start
  try { await warmupProxy(); } catch { /* ignore */ }

  try {
    const resp = await post(`${AUTH_PREFIX}/sign-up`, basePayload);
    if (resp.access_token && resp.refresh_token) setTokens(resp);
    try { await warmupProxy(); } catch { /* ignore */ }
    return resp;
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : String(err);
    // Si el proveedor de email está deshabilitado, reintentar con registro sólo por teléfono (si está disponible)
    if (/email_provider_disabled/i.test(msg)) {
      if (!hasPhone) {
        throw new Error('El registro por correo está deshabilitado. Regístrate con tu número de teléfono o usa Google/Facebook.');
      }
      const phoneOnly: Record<string, unknown> = { password, data: { full_name: fullName }, phone: phone!.trim() };
      if (captchaToken && enableSignupCaptcha) phoneOnly[captchaFieldName()] = captchaToken;
      const resp = await post(`${AUTH_PREFIX}/sign-up`, phoneOnly);
      if (resp.access_token && resp.refresh_token) setTokens(resp);
      try { await warmupProxy(); } catch { /* ignore */ }
      return resp;
    }
    throw err;
  }
}

export async function signInEmail(email: string, password: string, captchaToken?: string) {
  try {
    const body: Record<string, unknown> = { email, password };
    if (captchaToken) body[captchaFieldName()] = captchaToken;
    const resp = await post(`${AUTH_PREFIX}/sign-in`, body);
    if (resp.access_token && resp.refresh_token) setTokens(resp);
    try { await warmupProxy(); } catch { /* ignore */ }
    return resp;
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : String(err);
    const isInfra = /Server error 5\d\d|tardó demasiado tiempo|Error de red|CORS|Network|502|503|504/i.test(msg);
    if (!isInfra) throw err;
    // Fallback directo a Supabase para completar login en caso de cold start/5xx
    if (hasSupabaseEnv()) {
      try {
        const fb = await supabaseSignInFallback({ email, password });
        if (fb.access_token && fb.refresh_token) setTokens(fb);
        try { await warmupProxy(); } catch { /* ignore */ }
        return fb;
      } catch (fbErr) {
        const eMsg = (fbErr instanceof Error) ? fbErr.message : String(fbErr);
        if (/captcha/i.test(eMsg)) {
          throw new Error('La verificación de seguridad está activada en el servidor. Configura VITE_RECAPTCHA_SITE_KEY y el mismo site key en Supabase, o desactiva CAPTCHA en Supabase para pruebas.');
        }
        if (/Supabase\s+(400|401)/i.test(eMsg)) {
          throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
        }
        if (/Supabase\s+429|Too\s+Many|rate\s*limit/i.test(eMsg)) {
          throw new Error('Demasiados intentos. Intenta nuevamente en unos minutos.');
        }
        throw fbErr;
      }
    }
    throw err;
  }
}

export async function signInPhone(phone: string, password: string, captchaToken?: string) {
  try {
    const body: Record<string, unknown> = { phone, password };
    if (captchaToken) body[captchaFieldName()] = captchaToken;
    const resp = await post(`${AUTH_PREFIX}/sign-in`, body);
    if (resp.access_token && resp.refresh_token) setTokens(resp);
    try { await warmupProxy(); } catch { /* ignore */ }
    return resp;
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : String(err);
    const isInfra = /Server error 5\d\d|tardó demasiado tiempo|Error de red|CORS|Network|502|503|504/i.test(msg);
    if (!isInfra) throw err;
    if (hasSupabaseEnv()) {
      try {
        const fb = await supabaseSignInFallback({ phone, password });
        if (fb.access_token && fb.refresh_token) setTokens(fb);
        try { await warmupProxy(); } catch { /* ignore */ }
        return fb;
      } catch (fbErr) {
        const eMsg = (fbErr instanceof Error) ? fbErr.message : String(fbErr);
        if (/captcha/i.test(eMsg)) {
          throw new Error('La verificación de seguridad está activada en el servidor. Configura VITE_RECAPTCHA_SITE_KEY y el mismo site key en Supabase, o desactiva CAPTCHA en Supabase para pruebas.');
        }
        if (/Supabase\s+(400|401)/i.test(eMsg)) {
          throw new Error('Credenciales inválidas. Verifica tu teléfono y contraseña.');
        }
        if (/Supabase\s+429|Too\s+Many|rate\s*limit/i.test(eMsg)) {
          throw new Error('Demasiados intentos. Intenta nuevamente en unos minutos.');
        }
        throw fbErr;
      }
    }
    throw err;
  }
}

export async function refreshSession() {
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');
  // Primero: intentar vía backend (directo/proxy con retry/backoff).
  try {
    await warmupProxy();
    await new Promise(r => setTimeout(r, 500));
    // Usar el prefijo proxied correcto del backend
    const resp = await post(`${AUTH_PREFIX}/refresh`, { refresh_token: rt });
    if (resp.access_token && resp.refresh_token) setTokens(resp);
    return resp;
  } catch (primaryErr) {
    console.error('[apiAuth] refresh via backend failed', primaryErr)
    // Fallback final: invocar directamente a Supabase si se configuraron variables en frontend
    if (hasSupabaseEnv()) {
      try {
        const supabaseResp = await supabaseRefreshFallback(rt);
        if (supabaseResp.access_token && supabaseResp.refresh_token) setTokens(supabaseResp);
        console.info('[apiAuth] refreshSession: usado fallback directo a Supabase');
        return supabaseResp;
      } catch (fallbackErr) {
        console.error('[apiAuth] Supabase fallback failed', fallbackErr);
        const combined = new Error(
          `Refresh failed via backend: ${(primaryErr as Error).message}. Fallback to Supabase failed: ${(fallbackErr as Error).message}`
        );
        throw combined;
      }
    }
    throw primaryErr;
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

// Usar siempre ruta proxied para evitar fallos de CORS/502 en redirecciones OAuth.
export const getOAuthStartUrl = (provider: string, next: string, redirectTo?: string) => {
  const params = new URLSearchParams();
  params.set('provider', provider);
  params.set('next', next);
  if (redirectTo) params.set('redirect_to', redirectTo);
  const query = params.toString();
  if (import.meta.env.DEV) {
    const envBackend = import.meta.env.VITE_BACKEND_URL;
    if (envBackend && envBackend.trim()) {
      const base = envBackend.replace(/\/+$/, '');
      return `${base}/api/v1/auth/oauth/start?${query}`;
    }
    return `/api/v1/auth/oauth/start?${query}`;
  }
  return `/api/proxy/api/v1/auth/oauth/start?${query}`;
};

function captchaFieldName() {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return env.VITE_RECAPTCHA_SITE_KEY ? 'recaptcha_token' : 'hcaptcha_token';
}
