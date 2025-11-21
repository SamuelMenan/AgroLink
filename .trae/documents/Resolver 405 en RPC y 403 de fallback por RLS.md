## Causa probable
- El 405 en `POST /api/rpc/create_conversation` indica que el handler RPC está recibiendo otro método (HEAD/GET) o no está resolviendo la ruta dinámicamente en producción.
- El 403 del fallback confirma que RLS bloquea inserciones directas en `conversations`; el RPC `security definer` debe ejecutarse para crear conversación + participantes en la misma transacción.

## Cambios propuestos
1. Handlers RPC
- Actualizar `api/rpc.js` y `api/rpc/[fn].js` para:
  - Aceptar `HEAD` y devolver 200 (preflight/sondeos de CDN pueden usar HEAD).
  - Registrar `req.method` y `path` para validar qué método está llegando realmente.
  - Mantener `POST` como única operación efectiva; `GET`/otros seguirán 405.

2. Rewrites y funciones
- Añadir configuración en `vercel.json` para los nuevos handlers:
  - `functions.api/rpc.js.maxDuration = 30` y `functions.api/rpc/[fn].js.maxDuration = 30`.
- Verificar orden de rewrites para asegurar que `"/api/proxy/api/v1/rpc/(.*)" -> "/api/rpc/$1"` está antes que la regla catch-all `"/api/proxy/(.*)"`.

3. Cliente
- Mantener `fetch('/api/rpc/create_conversation')` en `src/services/messagingService.ts`.
- Añadir un `console.log` con `method='POST'` y `url` para correlación (ya tenemos `x-client-request-id`).

4. Validación
- Agregar prueba Vitest que simule respuesta HEAD 200 y POST 200 del RPC.
- Probar manualmente en entorno de preview: crear conversación y enviar mensaje inicial sin activar el fallback.

## Entregables
- Ediciones en `api/rpc.js`, `api/rpc/[fn].js`, `vercel.json`, y pruebas en `src/services/__tests__/messagingService.test.ts`.
- Logs adicionales en RPC para diagnóstico rápido si reaparece 405/404.

¿Procedo con estos cambios y despliegue de preview para verificar en UI?