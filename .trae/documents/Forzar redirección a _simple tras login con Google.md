## Objetivo
- Garantizar que, al iniciar sesión con Google, el usuario termine en `/simple` (local y producción), sin saltos de dominio.

## Ajustes en Frontend
- Usar `signInWithGoogle('/simple')` y `signInWithFacebook('/simple')` en los botones de Login (`src/pages/Login.tsx`).
- Construir la URL de inicio OAuth con `redirect_to` del origen actual: `getOAuthStartUrl('google', '/simple', window.location.origin + '/oauth/callback')` (`src/context/AuthContext.tsx`).
- Incluir `redirect_to` como parámetro de query en el helper (`src/services/apiAuth.ts`).

## Verificación del Callback
- Confirmar que `OAuthCallback` lea `?next=/simple`, guarde tokens y redirija con `location.replace('/simple')`:
  - Extracción y guardado de tokens: `src/pages/OAuthCallback.tsx:11-41`.
  - Normalización/seguridad de `next`: `src/pages/OAuthCallback.tsx:43-77`.
  - Redirección final: `src/pages/OAuthCallback.tsx:86-97`.

## Backend (sin cambios funcionales)
- Validar que el backend use `redirect_to` si llega en la query: `AgroLinkBackend/src/main/java/com/agrolink/api/OAuthController.java:55-68`.
- Mantener `sanitizeNext` para forzar rutas seguras como `/simple`: `AgroLinkBackend/src/main/java/com/agrolink/api/OAuthController.java:23-29`.
- Recomendación: en DEV, no fijar `FRONTEND_ORIGIN` (o fijarlo al dominio actual) para evitar sobreescrituras cuando no llega `redirect_to`.

## Configuración Supabase
- Agregar en Supabase `Site URL` y `Redirect URLs` de ambos entornos:
  - `https://agro-link-three.vercel.app`, `https://agro-link-three.vercel.app/oauth/callback`
  - `https://agro-link-jet.vercel.app`, `https://agro-link-jet.vercel.app/oauth/callback`
  - `http://localhost:5174`, `http://localhost:5174/oauth/callback`

## Reescrituras de Vercel
- Confirmar rewrites de SPA: `/oauth/callback` → `/index.html` (`vercel.json:24-25`).

## Pruebas
- Local: abrir `http://localhost:5174/login`, pulsar Google; verificar petición:
  - `GET /api/v1/auth/oauth/start?provider=google&next=%2Fsimple&redirect_to=http%3A%2F%2Flocalhost%3A5174%2Foauth%2Fcallback`
  - Tras Supabase, ver `http://localhost:5174/oauth/callback?next=/simple#access_token=...` y finalmente `http://localhost:5174/simple`.
- Producción: repetir en `agro-link-three.vercel.app` y `agro-link-jet.vercel.app`, comprobando que el dominio del callback coincide con el origen donde se inició.

## Notas sobre inconsistencias
- Si aparece 404 de despliegue, redeplegar la app en el dominio afectado para evitar saltos a un deployment inexistente.
- Si `origin` o `referer` llegan `null`, el flujo sigue funcionando al construirse el callback desde `redirect_to`.

¿Confirmas aplicar estos ajustes para que siempre te lleve a `/simple`?