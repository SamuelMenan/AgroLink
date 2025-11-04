import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Permitir que Vite busque otro puerto libre si 5174 está en uso
    strictPort: false,
  },
  preview: {
    port: 5174,
  },
})
