# Configuración de rewrites en Vercel

## Objetivo
Preservar el comportamiento actual de `/api/proxy/*` enviando tráfico al backend en Render, sin usar API Route para el proxy.

## Rewrites
- `/api/proxy/api/v1/notifications/by-user/(.*)` → `/api/notifications/by-user?user_id=$1`
- `/api/proxy/api/v1/notifications/read-all/(.*)` → `/api/notifications/read-all?user_id=$1`
- `/api/proxy/api/v1/conversations` → `https://agrolinkbackend.onrender.com/api/v1/conversations`
- `/api/proxy/api/v1/conversations/(.*)/participants` → `https://agrolinkbackend.onrender.com/api/v1/conversations/$1/participants`
- `/api/proxy/api/v1/products` → `/api/products`
- `/api/proxy/api/v1/messages` → `https://agrolinkbackend.onrender.com/api/v1/messages`
- `/api/proxy/(.*)` → `https://agrolinkbackend.onrender.com/$1`
- Assets y SPA fallback permanecen.

## Flujo
Cliente → `/api/proxy/...` → Vercel reescribe → Render. Las API Routes no participan en estos paths.

## Variables de entorno
- `VITE_BACKEND_URL` = `https://agrolinkbackend.onrender.com`
- `BACKEND_URL` = `https://agrolinkbackend.onrender.com`

## Monitoreo
- Cron Vercel: `GET /api/warm` cada 10 min.
- Métricas de 5xx: POST a `/api/metrics` desde el cliente en errores 5xx.

## Pruebas de regresión
- `npm run test:rewrites` ejecuta llamadas a rutas reescritas y reporta estados.