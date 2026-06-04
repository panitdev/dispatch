export type AppConfig = {
  apiBaseUrl: string
  kratosPublicUrl: string
}

declare global {
  interface Window {
    __ENV__?: Partial<AppConfig>
  }
}

const productionDefaults: AppConfig = {
  apiBaseUrl: '',
  kratosPublicUrl: '',
}

export function getAppConfig(): AppConfig {
  const defaults = import.meta.env.PROD
    ? productionDefaults
    : { apiBaseUrl: '', kratosPublicUrl: '' }

  return {
    apiBaseUrl: readPublicConfigValue(
      window.__ENV__?.apiBaseUrl,
      import.meta.env.VITE_API_BASE_URL,
      defaults.apiBaseUrl,
    ),
    kratosPublicUrl: readPublicConfigValue(
      window.__ENV__?.kratosPublicUrl,
      import.meta.env.VITE_KRATOS_PUBLIC_URL,
      defaults.kratosPublicUrl,
    ),
  }
}

function readPublicConfigValue(
  runtimeValue: string | undefined,
  buildValue: string | undefined,
  defaultValue: string,
) {
  return (runtimeValue ?? buildValue ?? defaultValue).replace(/\/$/, '')
}
