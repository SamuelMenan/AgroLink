# AgroLink Backend (Spring Boot)

Minimal Java backend scaffold to complement the React + Supabase frontend.

## Quick start

Prerequisites: Java 17+, Maven 3.9+

Build and run:

```bash
mvn spring-boot:run
```

Then open:
- Swagger UI: http://localhost:8080/swagger-ui.html
- API docs: http://localhost:8080/api-docs

## Config

Environment variables (optional if integrating Supabase from backend):
- SUPABASE_URL
- SUPABASE_SERVICE_KEY

These map to `application.yml` under `supabase.*`.

## Endpoints (scaffold)
- POST /api/reviews
- GET /api/products/{productId}/reviews
- GET /api/products/{productId}/rating-summary

Security is open by default in this scaffold. Add JWT/Auth before production.
