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

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getNow() {
  return apiFetch<ApiNowResponse>('/api/v1/now')
}

export function listProjects() {
  return apiFetch<ApiProject[]>('/api/v1/projects')
}

export function listProjectIssues(projectId: string, status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<ApiIssue[]>(`/api/v1/projects/${projectId}/issues${params}`)
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
