function getKratosPublicUrl(): string {
  return (((window as any).__ENV__?.kratosPublicUrl) ?? '').replace(/\/$/, '')
}

export type AuthStatus = 'loading' | 'authed' | 'unauthed'

export async function checkWhoami(): Promise<AuthStatus> {
  const kratosPublicUrl = getKratosPublicUrl()
  if (!kratosPublicUrl) {
    return 'authed'
  }

  try {
    const response = await fetch(`${kratosPublicUrl}/sessions/whoami`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    return response.ok ? 'authed' : 'unauthed'
  } catch {
    return 'authed'
  }
}

export function initiateLogin() {
  const kratosPublicUrl = getKratosPublicUrl()
  const returnTo = encodeURIComponent(window.location.href)
  window.location.href = `${kratosPublicUrl}/self-service/login/browser?return_to=${returnTo}`
}
