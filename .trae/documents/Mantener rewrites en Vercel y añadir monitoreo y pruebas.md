## Objetivo
Preservar la configuración actual de rewrites en Vercel (sin migrar a API Route), documentarla, añadir monitoreo continuo, y crear pruebas de regresión que validen el comportamiento.

## Estado y Configuración Actual
- Frontend: Vercel con rewrites activos para `/api/proxy/*` hacia Render.
- Backend: Render en `https://agrolinkbackend.onrender.com`.
- Cliente: fuerza rutas via `/api/proxy` (`src/services/apiClient.ts`) y servicios de mensajería (`src/services/messagingService.ts`).

## Acciones
1. Restaurar y preservar rewrites (exactos):
   - `"/api/proxy/api/v1/conversations" → "https://agrolinkbackend.onrender.com/api/v1/conversations"`
   - `"/api/proxy/api/v1/conversations/(.*)/participants" → "https://agrolinkbackend.onrender.com/api/v1/conversations/$1/participants"`
   - `"/api/proxy/api/v1/messages" → "https://agrolinkbackend.onrender.com/api/v1/messages"`
   - `"/api/proxy/api/v1/notifications/by-user/(.*)" → "/api/notifications/by-user?user_id=$1"`
   - `"/api/proxy/api/v1/notifications/read-all/(.*)" → "/api/notifications/read-all?user_id=$1"`
   - `"/api/proxy/(.*)" → "https://agrolinkbackend.onrender.com/$1"`
   - Mantener assets y fallback SPA (`/assets/*`, catch-all a `/index.html`).
   - Variables en Vercel: `VITE_BACKEND_URL` y `BACKEND_URL` apuntando a Render.

2. Documentación exhaustiva (README interno):
   - Explicar precedencia de rewrites sobre API Routes en Vercel.
   - Diagrama de flujo: Cliente (`/api/proxy/...`) → Vercel rewrite → Render.
   - Lista de endpoints cubiertos y ejemplos de llamadas.
   - Consideraciones de timeouts de Vercel/Render y cold start.

3. Monitoreo continuo:
   - Programar Cron en Vercel para llamar `GET /api/warm` cada 5–10 min (ya existe `api/warm.js`), reportando estado del backend.
   - Instrumentar el cliente para registrar métricas de 5xx en una ruta ligera (`/api/metrics`) sin afectar flujo (contiene url, status, timestamp).
   - Configurar alertas en Render (Health checks/Notifications) y en Vercel (Webhooks/email) cuando tasa de 5xx supere umbral.

4. Pruebas de regresión (sin migrar a API Route):
   - Script de integración (Playwright o Node fetch) contra producción que valida:
     - `POST /api/proxy/api/v1/conversations` crea conversación (mock user/token).
     - `POST /api/proxy/api/v1/conversations/{id}/participants` acepta duplicado (409 tolerado).
     - `POST /api/proxy/api/v1/messages` retorna `2xx`.
     - `GET /api/proxy/actuator/health` → `200`.
   - Pruebas de smoke en CI (GitHub Actions) ejecutadas diariamente.

5. No migrar a API Route:
   - Asegurar que el cliente siga usando `/api/proxy/*` y que los rewrites permanezcan activos.
   - Evitar cambios en `api/proxy/[...path].js` que lo conviertan en camino principal.

6. Alertas tempranas 502 en otras áreas:
   - Monitores adicionales para `/api/proxy/api/v1/products`, `/api/proxy/api/v1/notifications`, `/api/proxy/api/v1/auth/*`.
   - Umbral y notificación a email/Slack cuando latencia > 3s o 5xx > 2% en 15 min.

## Entregables
- Reinstalación de rewrites en `vercel.json` exactamente como listado.
- Documento de configuración y flujos.
- Cron y endpoint de warm ejecutándose y registrando.
- Scripts de pruebas de regresión y CI programado.
- Instrumentación de métricas y alertas 5xx.

¿Confirmas proceder con esta implementación? (Se mantendrá el enfoque de rewrites; no se migrará al API Route).