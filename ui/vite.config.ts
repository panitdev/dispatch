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

  return {
    resolve: { tsconfigPaths: true },
    server: {
      allowedHosts,
    },
    plugins: [
      devtools(),
      tanstackRouter({ target: 'react' }),
      tailwindcss(),
      viteReact(),
    ],
  }
})
