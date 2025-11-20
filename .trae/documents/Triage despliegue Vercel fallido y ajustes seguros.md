## Hipótesis de fallo
- Error en `vercel.json` (propiedad `crons` no habilitada/soportada en el proyecto/plan).
- Variables de entorno faltantes (`BACKEND_URL`, `VITE_BACKEND_URL`).
- Rewrites válidos, pero la build rechaza configuración adicional.

## Plan de acción
1. Revisar logs de Vercel:
   - Abre el deployment fallido y busca mensajes como “Invalid vercel.json property 'crons'” o “Invalid rewrite”.
   - Confirma que `BACKEND_URL` y `VITE_BACKEND_URL` estén configuradas.
2. Si el error es por `crons`:
   - Ajuste: eliminar temporalmente `"crons"` de `vercel.json` para asegurar despliegue estable.
   - Alternativa de monitoreo: configurar un ping externo (UptimeRobot) a `GET https://<tu-app>/api/warm` cada 10 min.
3. Mantener exactamente los rewrites actuales:
   - Preservar todas las entradas `"/api/proxy/*"` → Render y locales (`/api/products`, `/api/notifications/*`).
4. Validar variables de entorno y redeploy:
   - `BACKEND_URL=https://agrolinkbackend.onrender.com` y `VITE_BACKEND_URL=https://agrolinkbackend.onrender.com`.
   - Lanzar un nuevo deploy.
5. Pruebas de regresión:
   - Ejecutar `npm run test:rewrites` contra producción con `TEST_BASE_URL` y tokens.
   - Verificar `health`, `conversations`, `participants` (tolerando 409), `messages`.
6. Monitoreo continuo sin `crons` (si fue la causa):
   - Mantener `api/warm` y `api/metrics` activos.
   - Crear alertas basadas en logs para picos de 5xx.

## Entregables
- Despliegue exitoso manteniendo rewrites.
- Monitoreo activo mediante ping externo si `crons` no es viable.
- Pruebas de regresión ejecutadas y reportadas.

¿Procedo eliminando temporalmente `crons` del `vercel.json`, verifico env vars y preparo el redeploy con pruebas y monitoreo alternativo?