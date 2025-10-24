<div align="center">

# AgroLink

Plataforma digital para conectar campesinos con consumidores, eliminando intermediarios.

⚡ React + TypeScript + Vite · 🎨 Tailwind CSS v4 · 🧭 React Router · 🔐 (Próximo) Supabase

</div>

## ✨ Objetivo

AgroLink facilita la venta directa de productos agrícolas: precios justos para productores y productos frescos para consumidores. Este repositorio contiene el frontend en React listo para crecer con autenticación, catálogo, carrito y panel de productor.

## 🧱 Stack técnico

- React 19 + TypeScript
- Vite 7 (dev server y build)
- Tailwind CSS v4 (con `@tailwindcss/postcss`)
- React Router DOM (enrutamiento SPA)
- ESLint (reglas básicas)
- (Próximo) Supabase: auth, base de datos, storage de imágenes

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
  services/            # (Próximo) Clientes de API/Supabase
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

## ⚙️ Variables de entorno (Supabase – próximo)

Cuando integremos Supabase, crea un archivo `.env` en la raíz con:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Sugerido:
- Bucket de imágenes para productos (por ejemplo, `products`).
- Tablas: `users`, `products`, `orders`, `reviews`.
- `AuthContext` para gestionar usuario, login/logout y rutas protegidas.

## 🧩 Scripts disponibles

- `npm run dev` → Vite dev server.
- `npm run build` → Compila TypeScript y crea la build de producción.
- `npm run preview` → Sirve la build localmente.
- `npm run lint` → Ejecuta ESLint.

## 🗺️ Roadmap

- [ ] UI Kit (Button, Input, Card, Badge) en `components/ui/`.
- [ ] Auth con Supabase + `AuthContext` + `ProtectedRoute` para `/dashboard`.
- [ ] CRUD de productos (listar, crear, editar, subir imágenes a storage).
- [ ] Carrito persistente y flujo de checkout básico.
- [ ] Reseñas de productos (`reviews`).
- [ ] (Opcional) Chatbot asistente para productores.
- [ ] Tests unitarios básicos.

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

Puedes desplegar con Vercel/Netlify fácilmente:

- Build command: `npm run build`
- Publish directory: `dist`

Para GitHub Pages, podemos añadir un workflow de Actions y configurar el `base` de Vite si fuese necesario. Pídelo y lo dejo listo.

## 🤝 Contribuir

1. Crea una rama desde `main`.
2. Haz tus cambios y crea commits claros.
3. Abre un Pull Request describiendo el cambio y cómo probarlo.

## 📄 Licencia

Por definir. © 2025 Samuel Menan.
