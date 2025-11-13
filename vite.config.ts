import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Permitir que Vite busque otro puerto libre si 5174 está en uso
    strictPort: false,
    // Proxy backend Spring Boot para evitar 404 en llamadas /api/* durante desarrollo
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // opcional: ws: true si luego usamos WebSocket en /api
      }
    }
  },
  preview: {
    port: 5174,
  },
})
