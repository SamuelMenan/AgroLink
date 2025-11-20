## Diagnóstico
- 502 en `api/proxy/api/v1/conversations/.../participants` y `api/proxy/api/v1/messages` por backend (Render) con cold start.
- 409 por participante existente; ya se maneja.
- `contentScript.js` es de una extensión; no afecta.

## Solución técnica
- Precalentar backend al montar Productos y tras login.
- Aumentar tolerancia y backoff en `apiClient` para 5xx.
- Mejorar mensaje de error en `Products.tsx` para 5xx.
- Ampliar timeout del proxy upstream.
- Opcional: pings periódicos o plan de Render sin sleep.

## Cambios concretos
- `src/services/apiClient.ts`: ajustar `warmupBackend`, `sleep`, `maxRetries`.
- `src/pages/Products.tsx`: mapear 5xx a mensaje amigable en `sendMarketplaceMessage`.
- `api/proxy/[...path].js`: incrementar `AbortController` timeout.

## Verificación
- Ping de precalentamiento responde.
- Enviar mensaje sin 502 tras login.
- Pruebas tras cold start.

¿Procedo con estos cambios?