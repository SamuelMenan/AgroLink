<div align="center">

# 🌾 AgroLink

**Plataforma digital para conectar campesinos con consumidores, eliminando intermediarios**

⚡ React + TypeScript + Vite · 🎨 Tailwind CSS v4 · 🧭 React Router · 🔐 Supabase · 💬 Mensajería en tiempo real

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9%2B-blue.svg)](https://www.typescriptlang.org/)

</div>

## 📋 Descripción

AgroLink es una plataforma innovadora que revoluciona el comercio agrícola al conectar directamente a productores campesinos con consumidores finales. Nuestra misión es eliminar los intermediarios, garantizando precios justos para los productores y productos frescos y de calidad para los consumidores.

### 🎯 Objetivos Principales

- **Empoderar a los campesinos** con herramientas digitales para comercializar sus productos
- **Ofrecer transparencia** en precios y procesos de comercialización
- **Facilitar el acceso** a productos frescos y locales para los consumidores
- **Promover la economía local** y el comercio justo

## 🚀 Características Principales

### 🔐 Autenticación y Gestión de Usuarios
- Registro y autenticación segura con múltiples métodos
- Perfiles de usuario con configuración de privacidad
- Sistema de roles (productores, consumidores)
- Recuperación de contraseña y gestión de sesiones

### 📦 Gestión de Productos
- Catálogo público de productos agrícolas
- CRUD completo para gestión de productos por parte de productores
- Sistema de búsqueda y filtrado avanzado
- Gestión de imágenes y multimedia
- Atributos detallados de productos (temporada, disponibilidad, etc.)

### 🛒 Carrito de Compras y Pedidos
- Sistema de carrito persistente
- Gestión de pedidos para consumidores
- Panel de control para productores
- Seguimiento del estado de pedidos

### 💬 Mensajería y Comunicación
- Sistema de mensajería en tiempo real entre usuarios
- Notificaciones push y por email
- Centro de mensajes unificado
- Comunicación cifrada end-to-end

### 📊 Dashboard y Análisis
- Panel de control para productores con métricas
- Gestión de inventario
- Análisis de ventas y rendimiento
- Sistema de reseñas y calificaciones

## 🧱 Stack Tecnológico

### Frontend
- **React 19** con TypeScript para una experiencia de usuario moderna
- **Vite 7** para desarrollo rápido y builds optimizados
- **Tailwind CSS v4** para estilos modernos y responsivos
- **React Router DOM** para navegación SPA
- **Lucide React** para iconos consistentes

### Backend y Base de Datos
- **Supabase** como backend-as-a-service
- **PostgreSQL** para almacenamiento de datos
- **PostgREST** para API REST automática
- **Row Level Security (RLS)** para seguridad granular
- **Funciones PostgreSQL** para lógica de negocio compleja

### Seguridad
- **Autenticación JWT** con tokens seguros
- **Cifrado AES-GCM** para mensajes sensibles
- **hCaptcha** y **Google reCAPTCHA** para protección contra bots
- **Validación de entrada** y sanitización de datos

### Testing y Calidad
- **Vitest** para testing unitario
- **ESLint** para linting de código
- **TypeScript** para type safety
- **Testing Library** para tests de componentes React

## 📁 Estructura del Proyecto

```
agrolink/
├── src/                          # Código fuente del frontend
│   ├── assets/                   # Imágenes y recursos estáticos
│   ├── components/               # Componentes React reutilizables
│   │   ├── ui/                   # Componentes UI base (Button, Card, etc.)
│   │   ├── Navbar.tsx            # Barra de navegación principal
│   │   ├── ProductForm.tsx       # Formulario de productos
│   │   └── ...                   # Más componentes
│   ├── context/                  # Contextos de React (AuthContext, etc.)
│   ├── hooks/                    # Hooks personalizados
│   ├── pages/                    # Páginas de la aplicación
│   │   ├── Home.tsx              # Página principal
│   │   ├── Login.tsx             # Autenticación
│   │   ├── Products.tsx          # Catálogo de productos
│   │   ├── Cart.tsx              # Carrito de compras
│   │   └── dashboard/            # Panel de control
│   ├── services/                 # Servicios y APIs
│   ├── types/                    # Definiciones de TypeScript
│   ├── utils/                    # Utilidades y helpers
│   └── App.tsx                   # Componente principal
├── api/                          # API backend (Vercel Functions)
│   ├── auth/                     # Endpoints de autenticación
│   ├── conversations/            # Mensajería
│   ├── products.js               # Gestión de productos
│   └── ...                       # Más endpoints
├── supabase/                     # Configuración y migraciones
│   └── migrations/               # Scripts SQL de migración
├── sql/                          # Scripts SQL adicionales
├── public/                       # Archivos estáticos públicos
├── scripts/                      # Scripts de utilidad
└── tests/                        # Tests unitarios y de integración
```

## 🛠️ Instalación y Configuración

### Requisitos Previos
- Node.js 18 o superior
- npm o pnpm
- Cuenta en Supabase (opcional para desarrollo)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/agrolink.git
cd agrolink
```

2. **Instalar dependencias**
```bash
npm install
# o
pnpm install
```

3. **Configurar variables de entorno**
Crea un archivo `.env` en la raíz:
```env
# Frontend
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# Backend (si usas Vercel Functions)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-role-key
SUPABASE_ANON_KEY=tu-anon-key
ENCRYPTION_KEY=tu-clave-de-cifrado-hex-64-caracteres
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo
npm run dev:alt          # Puerto alternativo (5175)
npm run dev:auto         # Puerto automático

# Construcción y despliegue
npm run build            # Build de producción
npm run preview          # Previsualizar build

# Calidad de código
npm run lint             # Ejecutar ESLint
npm run test             # Ejecutar tests
npm run test:ui          # Tests con interfaz UI

# Testing especializado
npm run test:rewrites    # Test de rewrites de Vercel
```

## 🔧 Configuración de Supabase

### Tablas Principales

- **products** - Catálogo de productos agrícolas
- **users** - Perfiles de usuarios (extiende auth.users)
- **orders** - Pedidos y transacciones
- **conversations** - Mensajería entre usuarios
- **reviews** - Reseñas y calificaciones
- **notifications** - Sistema de notificaciones

### Políticas de Seguridad (RLS)

Todas las tablas tienen RLS habilitado con políticas específicas:
- Lectura pública para productos activos
- Escritura restringida a propietarios
- Mensajería entre usuarios conectados
- Privacidad configurable por usuario

### Funciones Personalizadas

- **get_user_public_info()** - Información pública de usuarios
- **create_order_with_items()** - Creación de pedidos complejos
- **update_product_availability()** - Gestión de inventario
- **send_notification()** - Sistema de notificaciones

## 🌐 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio en [Vercel](https://vercel.com)
2. Configura las variables de entorno
3. El despliegue es automático con cada push a main

### Configuración de Vercel

El archivo `vercel.json` ya está configurado con:
- Rewrites para API routes
- Funciones serverless con límites de tiempo
- Manejo de rutas del SPA
- Proxy hacia backend externo

```json
{
  "rewrites": [
    { "source": "/api/proxy/(.*)", "destination": "https://agrolinkbackend.onrender.com/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## 🧪 Testing

### Tests Unitarios
```bash
npm run test              # Ejecutar todos los tests
npm run test:ui           # Interfaz visual de tests
```

### Tests de Integración
- Scripts de prueba en `/scripts/`
- Tests de servicios en `/src/services/__tests__/`
- Tests de componentes con Testing Library

### Estrategia de Testing
- **Unit tests** para lógica de negocio
- **Integration tests** para APIs
- **Component tests** para UI
- **E2E tests** para flujos críticos

## 📱 Responsive Design

La aplicación es completamente responsiva con:
- Mobile-first approach
- Breakpoints de Tailwind CSS
- Componentes adaptativos
- Optimización para dispositivos táctiles

## ♿ Accesibilidad

- Etiquetas ARIA apropiadas
- Navegación por teclado
- Contraste de colores WCAG 2.1
- Soporte para lectores de pantalla

## 🔒 Seguridad

### Medidas Implementadas
- Cifrado de mensajes sensibles
- Validación de entrada robusta
- Protección CSRF
- Rate limiting en APIs
- Sanitización de datos

### Mejores Prácticas
- Variables de entorno para secretos
- No exponer service keys en frontend
- Principio de menor privilegio
- Auditoría regular de dependencias

## 📊 Monitoreo y Métricas

- Sistema de métricas integrado
- Monitoreo de errores
- Logs estructurados
- Análisis de rendimiento

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guías de Contribución

- Sigue las convenciones de código existentes
- Añade tests para nuevas funcionalidades
- Actualiza documentación cuando sea necesario
- Usa commits semánticos

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Autores

- **Samuel Menan** - Desarrollo principal

## 🙏 Agradecimientos

- Comunidad de código abierto
- Contribuidores del proyecto
- Usuarios beta por su feedback

## 📞 Soporte

Para soporte técnico o preguntas:
- Abre un issue en GitHub
- Contacta al equipo de desarrollo
- Revisa la documentación en `/docs`

---

<div align="center">

**⭐ Si este proyecto te ha sido útil, considera darle una estrella en GitHub!**

</div>