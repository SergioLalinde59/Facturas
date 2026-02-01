import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://127.0.0.1:8002';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5174,
      host: true, // Allow external access (Docker)
      strictPort: true,
      allowedHosts: ['facturas.local', 'localhost'],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        }
      }
    }
  }
})
