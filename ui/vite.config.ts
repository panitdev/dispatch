import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = env.VITE_DEV_ALLOWED_HOSTS
    ? env.VITE_DEV_ALLOWED_HOSTS.split(',')
    : []
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    resolve: { tsconfigPaths: true },
    server: {
      allowedHosts,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      devtools(),
      tanstackRouter({ target: 'react' }),
      tailwindcss(),
      viteReact(),
    ],
  }
})
