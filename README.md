<div align="center">

# AgroLink

Plataforma digital para conectar campesinos con consumidores, eliminando intermediarios.

⚡ React + TypeScript + Vite · 🎨 Tailwind CSS v4 · 🧭 React Router · 🔐 Backend API (Spring Boot + Supabase proxy)

</div>

## ✨ Objetivo

AgroLink facilita la venta directa de productos agrícolas: precios justos para productores y productos frescos para consumidores. Este repositorio contiene el frontend en React listo para crecer con autenticación, catálogo, carrito y panel de productor.

## 🧱 Stack técnico

- React 19 + TypeScript (frontend)
- Vite 7 (dev server y build)
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- React Router DOM (SPA)
- ESLint (reglas básicas)
- Spring Boot (backend) con capa proxy hacia Supabase (auth, PostgREST, storage) — el frontend ya NO se conecta directo a Supabase.

## 📁 Estructura del proyecto

```
src/
  assets/              # Imágenes y estáticos versionados (logo, etc.)
  components/
    Navbar.tsx         # Barra de navegación principal
    ui/                # (Próximo) Componentes reutilizables: Button, Card, Input...
  context/             # (Próximo) AuthContext y otros contextos globales
  hooks/               # Hooks personalizados
  pages/               # Páginas de la app
    Home.tsx           # /
    Login.tsx          # /login
    Register.tsx       # /register
    Dashboard.tsx      # /dashboard
    Products.tsx       # /products
    Cart.tsx           # /cart
    NotFound.tsx       # 404
  services/            # Clientes de API (fetch a backend); sin SDK de Supabase
  types/               # Tipos compartidos (incluye static.d.ts para assets)
  utils/               # Utilidades/ayudantes
  App.tsx              # Rutas y layout principal
  main.tsx             # Entry + BrowserRouter + favicon dinámico
index.html             # HTML base (sin favicon hardcodeado)
public/                # Estáticos sin procesamiento (sirven en "/")
```

## 🧭 Rutas principales

- `/` → Página principal (presentación de AgroLink)
- `/login` y `/register` → Autenticación de usuarios
- `/dashboard` → Panel del campesino (protegida próximamente)
- `/products` → Catálogo público
- `/cart` → Carrito de compras

## 🎨 Estilos con Tailwind v4

- Tailwind ya está activo usando la sintaxis v4. En `src/index.css`:

```css
@import "tailwindcss";
```

- Configuración: `tailwind.config.ts` y `postcss.config.js` (usa `@tailwindcss/postcss`).
- Clases utilitarias aplicadas en páginas y componentes; no dependemos del CSS demo de Vite.

## 🖼️ Logo y favicon

- Logo principal: `src/assets/logo.png`.
- La Navbar importa el logo para asegurar hashing/caché correcto:

```tsx
import appLogo from '../assets/logo.png'
<img src={appLogo} alt="AgroLink" className="h-8 w-8" />
```

- Favicon dinámico: en `src/main.tsx` se importa el mismo `logo.png` y se inyecta un `<link rel="icon">` en tiempo de ejecución. Esto funciona en dev y build sin rutas rotas.
- Si prefieres un favicon estático, puedes colocar `public/favicon.png` y referenciarlo en `index.html` con un `<link rel="icon">` (por ahora está gestionado por código para evitar cacheos y 404).

## 🚀 Arranque rápido (Windows PowerShell)

Requisitos: Node.js 18+ y npm.

```powershell
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Lint opcional
npm run lint

# Build producción
npm run build

# Previsualizar build
npm run preview
```

## ⚙️ Variables de entorno

El frontend no se conecta directamente a la base de datos; todo pasa por el backend. Sin embargo, existe un fallback opcional para refrescar tokens directamente con Supabase si el backend está frío o inaccesible temporalmente.

Backend (Spring Boot) debe definir:
```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
ENCRYPTION_KEY=<64 hex chars o base64 de 32 bytes>
```

Notas:
- `SUPABASE_SERVICE_KEY` se usa en el servidor para operaciones privilegiadas (no exponerlo en frontend).
- `ENCRYPTION_KEY` habilita cifrado AES-GCM para mensajes (y futuros campos sensibles). Puede ser:
  - Hex de 64 caracteres (256-bit) o
  - Base64 de 32 bytes.
- El frontend maneja tokens JWT y llama al backend (`/api/v1/auth/*`).

Frontend (opcional, solo para fallback de refresh):
```bash
# URL del proyecto Supabase y anon key (nunca el service key)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Notas del fallback:
- El frontend intentará refrescar vía backend primero (directo y vía proxy con reintentos). Si ambas rutas fallan, usará el fallback directo a Supabase con `VITE_SUPABASE_ANON_KEY`.
- Este fallback solo requiere la anon key y respeta CORS de Supabase. Si tu proyecto restringe orígenes, añade tu dominio de Vercel en Supabase.
- Mantén `VITE_BACKEND_URL` apuntando al dominio del backend para la estrategia "direct-first".

## 🧩 Scripts disponibles

- `npm run dev` → Vite dev server.
- `npm run build` → Compila TypeScript y crea la build de producción.
- `npm run preview` → Sirve la build localmente.
- `npm run lint` → Ejecuta ESLint.

## 🗺️ Roadmap

- [ ] UI Kit (Button, Input, Card, Badge) en `components/ui/`.
- [ ] Hardening de Auth (refresh tokens + expiración clara).
- [ ] CRUD completo de productos y media (ya proxied vía backend).
- [ ] Carrito persistente y checkout.
- [ ] Reseñas de productos (backend listo, frontend extendido parcialmente).
- [ ] Mensajería con mejoras (receipts realtime; pendiente adaptación sin Supabase client).
- [ ] Notificaciones push (ya migradas a backend; falta canal realtime opcional).
- [ ] Tests unitarios y de integración frontend/backend.

## 🧪 Cómo probar rápidamente

1. Ejecuta `npm run dev` y abre la URL que te muestre (p. ej., `http://localhost:5173/` o `5174`).
2. Navega por las rutas con la Navbar.
3. Para verificar el favicon, haz un “hard refresh” (Ctrl+F5) o abre una ventana privada (los favicons se cachean fuerte).

## 🛠️ Solución de problemas

- “Port 5173 is in use”: Vite cambiará automáticamente de puerto (ver consola). También puedes cerrar procesos que usen ese puerto.
- “El logo no aparece”: asegúrate de que `src/assets/logo.png` existe y que recargaste fuerte el navegador. En dev, prueba abrir directamente la ruta que imprime Vite para el asset (inspecciona en el DOM el `<img>` de la Navbar).
- Tailwind no aplica: verifica que `src/index.css` contiene `@import "tailwindcss";` y que el server está en marcha.
- Diferencias CRLF/LF: Git puede avisar en Windows; no afecta el funcionamiento.

## 📦 Despliegue

Frontend:
```bash
npm run build
```
Sirve el contenido de `dist/` con CDN / hosting estático (Vercel, Netlify, etc.).

Backend: empaquetar JAR y desplegar en servicio que proteja las variables sensibles (`SUPABASE_*`, `ENCRYPTION_KEY`).

Separar dominios (ej. `api.agrolink.com` y `app.agrolink.com`) y habilitar CORS seguro.

## 🤝 Contribuir

1. Crear rama desde `main`.
2. Cambios con foco mínimo (no mezclar refactors grandes con features).
3. PR describiendo: motivación, endpoints afectados y pasos de prueba.

## 📄 Licencia

Por definir. © 2025 Samuel Menan.
