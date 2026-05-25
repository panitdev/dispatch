export type ApiNowIssue = {
  title: string
  description: string | null
  project: {
    id: string
    key: string
    name: string
    color: string
  }
  status: string
  labels: string[]
}

export type ApiNowResponse = {
  continue: ApiNowIssue[]
  next: ApiNowIssue[]
  drafts: ApiNowIssue[]
}

export type ApiProject = {
  id: string
  key: string
  name: string
  color: string
  parent_id: string | null
  sub_projects: ApiProject[]
  created_at: string
  updated_at: string
}

export type ApiIssue = {
  id: string
  key: string
  project_id: string
  parent_id: string | null
  title: string
  status: string
  priority: number
  labels: string[]
  assignee_id: string | null
  blocks: unknown[]
  created_at: string
  updated_at: string
  blocked_by: string[]
  related_to: string[]
}

export type CreateProjectInput = {
  key: string
  name: string
  color: string
  parent_id?: string
}

export type CreateIssueInput = {
  project_id: string
  title: string
  status?: string
  blocks?: unknown[]
}

export type CreateIssueResponse = ApiIssue

const clientApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
  /\/$/,
  '',
)
const serverApiBaseUrl = (
  import.meta.env.VITE_SERVER_API_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  ''
).replace(/\/$/, '')
const loggedServerHosts = new Set<string>()

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isAuthError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  )
}

export function getDisplayErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (isAuthError(error)) {
    return 'Your session is missing or expired. Sign in again and reload.'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  const startedAt = performance.now()
  const apiBaseUrl =
    typeof window === 'undefined' ? serverApiBaseUrl : clientApiBaseUrl
  const url = `${apiBaseUrl}${path}`

  if (typeof window === 'undefined') {
    await logServerResolution(url)
  }

  console.log(
    `[timing] apiFetch:start ${url} hasCookie=${headers.has('cookie')} hasAuth=${headers.has('authorization')}`,
  )

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  console.log(
    `[timing] apiFetch:end ${url} status=${response.status} ${Math.round(
      performance.now() - startedAt,
    )}ms`,
  )

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    let message = ''

    if (contentType.includes('application/json')) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null
      message = payload?.error ?? ''
    } else {
      message = await response.text()
    }

    throw new ApiError(
      response.status,
      message || `Request failed with status ${response.status}`,
    )
  }

  return response.json() as Promise<T>
}

async function logServerResolution(rawUrl: string) {
  const hostname = new URL(rawUrl).hostname
  if (loggedServerHosts.has(hostname)) {
    return
  }
  loggedServerHosts.add(hostname)

  try {
    const dns = await import('node:dns/promises')
    const results = await dns.lookup(hostname, { all: true })
    console.log(
      `[timing] apiFetch:resolve ${hostname} -> ${results
        .map((result) => `${result.address}/ipv${result.family}`)
        .join(', ')}`,
    )
  } catch (error) {
    console.log(
      `[timing] apiFetch:resolve ${hostname} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export function getNow(init?: RequestInit) {
  return apiFetch<ApiNowResponse>('/api/v1/now', init)
}

export function listProjects(init?: RequestInit) {
  return apiFetch<ApiProject[]>('/api/v1/projects', init)
}

export function getProject(projectId: string, init?: RequestInit) {
  return apiFetch<ApiProject>(`/api/v1/projects/${projectId}`, init)
}

export function listProjectIssues(
  projectId: string,
  status?: string,
  init?: RequestInit,
) {
  const params = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<ApiIssue[]>(`/api/v1/projects/${projectId}/issues${params}`, init)
}

export function createProject(input: CreateProjectInput) {
  return apiFetch<ApiProject>('/api/v1/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export function createIssue(input: CreateIssueInput) {
  return apiFetch<CreateIssueResponse>(`/api/v1/projects/${input.project_id}/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      status: input.status ?? 'draft',
      blocks: input.blocks ?? [],
    }),
  })
}
