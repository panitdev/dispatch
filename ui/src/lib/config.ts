import { createServerFn } from '@tanstack/react-start'

export type AppConfig = {
  apiBaseUrl: string
  kratosPublicUrl: string
  serverApiBaseUrl: string
}

export const getAppConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AppConfig> => {
    // Dynamic import runs in the Workers runtime (or Miniflare in dev).
    // TanStack Start's server function transform keeps this server-only.
    // @ts-ignore - cloudflare:workers is a built-in module in the Workers runtime
    const { env } = await import('cloudflare:workers')
    const cfEnv = env as Record<string, string | undefined>
    return {
      apiBaseUrl: (cfEnv.API_BASE_URL ?? '').replace(/\/$/, ''),
      kratosPublicUrl: (cfEnv.KRATOS_PUBLIC_URL ?? '').replace(/\/$/, ''),
      serverApiBaseUrl: (cfEnv.SERVER_API_BASE_URL ?? cfEnv.API_BASE_URL ?? '').replace(/\/$/, ''),
    }
  },
)
