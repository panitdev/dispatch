import { defineConfig, loadEnv, type PluginOption } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const host = env.VITE_DEV_HOST
  const port = Number(env.VITE_DEV_PORT ?? 3000)
  const https = env.VITE_DEV_HTTPS === 'true'
  const allowedHosts = env.VITE_DEV_ALLOWED_HOSTS?.split(',') ?? []

  const plugins: PluginOption[] = [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]

  if (https && host) {
    plugins.push(
      mkcert({
        hosts: [host],
      }),
    )
  }

  return {
    resolve: { tsconfigPaths: true },

    server: host
      ? {
        host,
        port,
        strictPort: true,
        allowedHosts
      }
      : undefined,

    plugins,
  }
})
