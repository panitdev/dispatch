import { getAppConfig } from './config'

export type ApiHealth = {
  status: string
  version: string
  commit_hash: string
}

export type ApiNowIssue = {
  id: string
  key: string
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

export type ApiIssueLabel = {
  id: string
  project_id: string
  name: string
  color: string
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
  blocks: IssueBodyBlock[]
  created_at: string
  updated_at: string
  blocked_by: string[]
  related_to: string[]
}

export type IssueBodyBlock = {
  id: string
  kind: string
  title?: string
  content: string
  metadata?: JsonValue
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

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
  labels?: string[]
  blocks?: unknown[]
}

export type CreateIssueResponse = ApiIssue

function getClientApiBaseUrl(): string {
  return getAppConfig().apiBaseUrl
}

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
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  )
}

export function getDisplayErrorMessage(error: unknown, fallback: string) {
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
  const apiBaseUrl = getClientApiBaseUrl()
  const url = `${apiBaseUrl}${path}`

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
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      message = payload?.error ?? ''
    } else {
      message = await response.text()
    }

    throw new ApiError(
      response.status,
      message || `Request failed with status ${response.status}`,
    )
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}

async function apiTextFetch(path: string, init?: RequestInit): Promise<string> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'text/markdown')
  const apiBaseUrl = getClientApiBaseUrl()
  const url = `${apiBaseUrl}${path}`

  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    let message = ''

    if (contentType.includes('application/json')) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      message = payload?.error ?? ''
    } else {
      message = await response.text()
    }

    throw new ApiError(
      response.status,
      message || `Request failed with status ${response.status}`,
    )
  }

  return response.text()
}

export async function getHealth(init?: RequestInit): Promise<ApiHealth> {
  const apiBaseUrl = getAppConfig().apiBaseUrl
  const response = await fetch(`${apiBaseUrl}/health`, init)
  return response.json() as Promise<ApiHealth>
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
  return apiFetch<ApiIssue[]>(
    `/api/v1/projects/${projectId}/issues${params}`,
    init,
  )
}

export function listProjectLabels(projectId: string, init?: RequestInit) {
  return apiFetch<ApiIssueLabel[]>(`/api/v1/projects/${projectId}/labels`, init)
}

export type CreateProjectLabelInput = {
  name: string
  color: string
}

export function createProjectLabel(
  projectId: string,
  input: CreateProjectLabelInput,
) {
  return apiFetch<ApiIssueLabel>(`/api/v1/projects/${projectId}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export type UpdateProjectLabelInput = {
  name?: string
  color?: string
}

export function updateProjectLabel(
  projectId: string,
  labelId: string,
  input: UpdateProjectLabelInput,
) {
  return apiFetch<ApiIssueLabel>(
    `/api/v1/projects/${projectId}/labels/${labelId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function deleteProjectLabel(projectId: string, labelId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/labels/${labelId}`, {
    method: 'DELETE',
  })
}

export function getIssue(issueId: string, init?: RequestInit) {
  return apiFetch<ApiIssue>(`/api/v1/issues/${issueId}`, init)
}

export function getIssueBodyMarkdown(issueId: string, init?: RequestInit) {
  return apiTextFetch(`/api/v1/issues/${issueId}/body.md`, init)
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

export type UpdateProjectInput = {
  name?: string
  color?: string
}

export function updateProject(projectId: string, input: UpdateProjectInput) {
  return apiFetch<ApiProject>(`/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteProject(projectId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
  })
}

export type UpdateIssueInput = {
  title?: string
  status?: string
  priority?: number
  labels?: string[]
  blocks?: unknown[]
}

export function updateIssue(issueId: string, input: UpdateIssueInput) {
  return apiFetch<ApiIssue>(`/api/v1/issues/${issueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteIssue(issueId: string) {
  return apiFetch<void>(`/api/v1/issues/${issueId}`, {
    method: 'DELETE',
  })
}

export function createIssue(input: CreateIssueInput) {
  return apiFetch<CreateIssueResponse>(
    `/api/v1/projects/${input.project_id}/issues`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        status: input.status ?? 'draft',
        labels: input.labels ?? [],
        blocks: input.blocks ?? [],
      }),
    },
  )
}
