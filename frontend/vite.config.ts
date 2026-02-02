import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => {
  const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8002';

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
          // @ts-ignore - Vite proxy types are incomplete
          configure: (proxy, _options) => {
            // @ts-ignore
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              // Rewrite Location header in redirects to prevent backend:8000 URLs
              const location = proxyRes.headers['location'];
              if (location && location.includes('backend:8000')) {
                proxyRes.headers['location'] = location.replace(/http:\/\/backend:8000/g, '');
              }
            });
          }
        }
      }
    }
  }
})
