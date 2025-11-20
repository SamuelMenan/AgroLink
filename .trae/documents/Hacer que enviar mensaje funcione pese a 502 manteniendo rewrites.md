## Análisis
- Los 502 repetidos en `conversations/by-user/<uid>` indican que esa consulta inicial falla por cold start/latencia en Render y el cliente reintenta varias veces.
- Aunque ya hay prewarm y reintentos moderados, el flujo de “Enviar” sigue dependiendo de `by-user` para encontrar conversaciones previas, lo que multiplica los 502.

## Cambios propuestos (manteniendo rewrites)
1. Evitar `by-user` en el flujo de “Enviar”:
   - Crear un camino rápido: `ensureConversationQuick(userId, otherUserId)` que siempre crea una conversación y añade participantes (tolera 409), sin listar ni recorrer conversaciones previas.
   - Usar este camino en `contactUser(...)` para Producto.
2. Warmup adicional en cliente HTTP:
   - Cuando se detecte un 5xx, además de `actuator/health`, invocar `GET /api/warm` para despertar Render más rápido.
3. Mantener el resto sin cambios:
   - Rewrites actuales en `vercel.json` intactos.
   - Telemetría de 5xx hacia `/api/metrics` ya activa.

## Verificación
- Al pulsar “Enviar”, solo se realizan: `POST /api/proxy/api/v1/conversations` + dos `POST /api/proxy/api/v1/conversations/{id}/participants` (409 tolerado) + `POST /api/proxy/api/v1/messages`.
- “by-user” deja de participar en el flujo, reduciendo 502 y mejorando la probabilidad de éxito.

¿Procedo con estos cambios en el frontend?