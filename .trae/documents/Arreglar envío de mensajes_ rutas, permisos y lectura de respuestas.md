## Diagnóstico
- 404 en `POST /api/proxy/api/v1/rpc/create_conversation`: la ruta no está reescrita en `vercel.json` y termina en el backend de Render sin endpoint RPC; se activa el fallback en `src/services/messagingService.ts:96–189`.
- 403 en `POST /api/proxy/api/v1/conversations`: el handler `api/conversations.js` crea primero la conversación y luego inserta participantes; si las políticas RLS de Supabase exigen tener participante en la misma transacción, la inserción de la conversación puede devolver 403 (coincide con el síntoma).
- “Failed to execute 'text' on 'Response': body stream already read”: en `src/services/messagingService.ts:117–139` se lee `convResp.text()` y, sin reasignar la respuesta, se vuelve a leer `convResp.text()` en otro bloque `if`, provocando doble lectura del mismo stream.

## Cambios propuestos
1. Rutas API
- Añadir un handler `api/rpc.js` que proxie llamadas RPC a Supabase (`/rest/v1/rpc/:fn`) con `Authorization` del usuario y `apikey` anónima.
- Añadir rewrites en `vercel.json` para mapear `"/api/proxy/api/v1/rpc/(.*)" -> "/api/rpc/$1"` y asegurar que `"/api/proxy/api/v1/conversations"` sigue redirigiendo a `"/api/conversations"`.

2. Permisos y autenticación
- Mantener validación de `Authorization` en `api/conversations.js` y decodificación JWT; registrar `authUserId`.
- Consolidar la creación de conversación + participantes en el RPC (una sola transacción) para evitar 403 por RLS.
- En envío de mensajes, si se recibe 403 por no ser participante, intentar una vez `POST /api/conversations?action=add-participant&id=...` y reintentar el envío.

3. Lectura única del cuerpo
- Corregir `createConversation` fallback para leer el cuerpo de error solo una vez (reutilizar `firstTxt` y no llamar de nuevo a `convResp.text()`).
- Auditar llamadas críticas y aplicar el mismo patrón donde corresponda.

4. Fallback adaptativo
- Si el RPC devuelve 404, usar el endpoint local `POST /api/conversations` (ya existente) y dejar que el servidor inserte participantes; en caso de que el vendedor quede pendiente (`seller_pending: true`), la UI debe invocar `addParticipant` antes de que el vendedor envíe mensajes.

5. Tiempos de espera y reintentos
- Reutilizar el cliente `apiClient` para todas las llamadas desde `messagingService` a `"/api/v1/conversations"` y sub-acciones, beneficiando de timeouts (8–15s), backoff con jitter y circuit breaker.
- Para `fetch` directos necesarios (RPC), envolverlos con `AbortController` y timeout consistente.

## Detalle por archivo
- `vercel.json`
  - Añadir rewrite: `{"source": "/api/proxy/api/v1/rpc/(.*)", "destination": "/api/rpc/$1"}`.
  - Mantener las rewrites existentes de `conversations`. Opcional: eliminar rutas no usadas `.../messages` por path, ya que el handler usa `action=messages`.

- `api/rpc.js` (nuevo)
  - Handler que recibe `POST /api/rpc/:fn`, valida `Authorization` y hace `POST ${SUPABASE_URL}/rest/v1/rpc/:fn` con headers `{ apikey: SUPABASE_ANON_KEY, Authorization: Bearer <user> }` y cuerpo JSON.
  - Responder con el `json()` de Supabase o propagar errores con `text()` leído una sola vez.

- `api/conversations.js`
  - Mantener lógica actual; añadir logging del header `x-client-request-id` si está presente.
  - Documentar en código que 403 en inserción del vendedor se trata como `seller_pending`.

- `src/services/messagingService.ts`
  - Corregir doble lectura del stream en fallback (`lines ~117–139`): usar `firstTxt` en la segunda rama o leer una sola vez.
  - Cambiar llamadas a `/conversations` y `messages` para usar `apiClient.post/get` con rutas `"/api/v1/conversations?..."` (el cliente añade `/api/proxy` automáticamente), manteniendo `Authorization`.
  - En `sendMessage`, si 403 por participación, ejecutar `addParticipant(conversationId, senderId)` y reintentar una vez.
  - Generar `x-client-request-id` por llamada y pasarlo en headers para correlación con logs del servidor.

## Pruebas (Vitest)
- Unit: `createConversation` con RPC 404 → fallback exitoso, sin error de doble lectura.
- Unit: `sendMessage` devuelve 403 por no ser participante → se llama `addParticipant` y reintenta; éxito.
- Unit: RPC éxito devuelve UUID → se envía mensaje inicial y se valida.
- Integration simulada: flujo completo comprador crea conversación, vendedor pendiente, vendedor añade participante y envía mensaje; `getMessages` lista mensajes ordenados.
- Cobertura de tiempos de espera: simular timeouts y verificar reintentos/backoff del `apiClient`.

## Registro y diagnóstico
- Cliente: incluir `x-client-request-id`, estado, URL, `timestamp` en los `console.error` existentes.
- Servidor: ya emite `[CONVERSATIONS-<id>]`; loggear también el `x-client-request-id` si existe.

## Validación
- Ejecutar `npm run test` y revisar que todas las pruebas nuevas pasan.
- Verificar manualmente en entorno local: crear conversación (RPC ok), fallback (RPC 404) y envío de mensajes sin 403.
- Confirmar que ya no aparece “body stream already read” en la consola y que los errores tienen trazas claras.