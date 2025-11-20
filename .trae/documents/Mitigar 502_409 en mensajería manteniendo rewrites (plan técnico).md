## Objetivo
Reducir y manejar correctamente los 502 y 409 en los endpoints de mensajería, preservando los rewrites actuales en Vercel y mejorando resiliencia del cliente.

## 1) /api/proxy/api/v1/conversations/by-user/{user_id}
- Causas 502 probables:
  - Cold start/latencia en Render.
  - Consulta costosa y/o múltiples reintentos simultáneos desde el cliente.
  - Proxy directo (rewrite) sin capa de reintentos del server (se hace todo en cliente).
- Verificaciones:
  - Confirmar env vars en Vercel: `BACKEND_URL` y `VITE_BACKEND_URL` apuntando a Render.
  - Comprobar salud: `GET /api/proxy/actuator/health` → 200.
- Acciones en cliente (sin cambiar rewrites):
  - Implementar backoff exponencial con jitter en `apiClient` (p=2; jitter ±25%; maxRetries=4; timeout=12s) y consolidar logging a `/api/metrics`.
  - Prewarm explícito antes de enviar: `GET /api/proxy/actuator/health` + `GET /api/warm`.
  - Evitar depender de `by-user` para el flujo “Enviar”: usar `ensureConversationQuick` (crear conv + add participants con 409 tolerado) y dejar `by-user` para pantallas de listado.
  - Cachear resultado de `by-user` corto (TTL 60–120s) en localStorage para reducir llamadas repetidas.

## 2) /api/proxy/api/v1/conversations/{conversation_id}/participants
- 409: esperado por PK (conversation_id,user_id). Decidir que 409 = success idempotente.
- 502: mismas causas que arriba.
- Acciones:
  - Asegurar envío secuencial (primero current user, luego other). Ya está en `messagingService`, reforzar reintentos en cliente.
  - Tratar 409 como éxito y no reintentar.
  - Sincronización: debouncing del click “Enviar” para evitar duplicados.

## 3) /api/proxy/api/v1/messages
- 502: cold start/latencia; costos de cifrado/DB.
- Acciones:
  - Backoff+timeout como en (1).
  - Prewarm antes de `POST /messages`.
  - Si el envío falla tras reintentos, mostrar mensaje amigable y registrar evento en `/api/metrics` con correlación (conversationId, senderId).

## Mecanismos transversales
- Circuit breaker (cliente):
  - Por endpoint base (`/api/v1/messages`, `/api/v1/conversations/by-user`): si 5xx consecutivos > N en ventana, abrir breaker 30–60s; mostrar aviso al usuario y evitar tormenta de reintentos.
- Logging/telemetría:
  - `apiClient` ya emite a `/api/metrics`; añadir `endpoint`, `attempts`, `latency`, `userId` (si disponible), `conversationId`.
- Documentación de errores:
  - 502: cold start/indisponibilidad; solución: prewarm, backoff, breaker.
  - 409: idempotencia de participantes; solución: tratarlo como éxito.
  - 401/403: auth/permisos; solución: redirigir a login o mostrar detalle.

## Pruebas
- Unit tests (apiClient):
  - Mock `fetch` para simular 502 → validar backoff exponencial y reporte a `/api/metrics`.
  - Validar circuito breaker abre y cierra correctamente.
- Integración (scripts/test-rewrites.mjs contra prod):
  - Health, create conversation, add participants (acepta 409), send message.

## Monitoreo
- Ping externo a `GET /api/warm` cada 10 min para mantener Render caliente.
- Alertas con base en logs de Vercel (`/api/metrics`) cuando tasa de 5xx supere umbral.

## Impacto en código (frontend)
- `src/services/apiClient.ts`: backoff exponencial con jitter, breaker, mejor telemetría.
- `src/services/messagingService.ts`: mantener `ensureConversationQuick` como vía rápida en “Enviar”.
- `src/pages/Products.tsx`: prewarm extra y debounce del botón.

¿Procedo a implementar estas mejoras en el cliente y pruebas, manteniendo los rewrites tal cual?