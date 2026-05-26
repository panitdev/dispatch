import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

import {
  getNow,
  getIssue,
  getProject,
  listProjectIssues,
  listProjects,
} from './api'

import type { ApiIssue, ApiNowIssue, ApiProject } from './api'

export type IssuePageData = {
  issue: ApiIssue
  project: ApiProject | null
}

export type ProjectsPageData = {
  projects: ApiProject[]
  issuesByProjectId: Record<string, ApiIssue[]>
}

export type ProjectPageData = {
  project: ApiProject
  issues: ApiIssue[]
}

export const getIssuePageData = createServerFn({ method: 'GET', strict: false })
  .inputValidator((d: unknown) => d as { issueId: string })
  .handler(async ({ data }) => {
    const { issueId } = data
    const done = startTiming('getIssuePageData')
    const init = await withServerInit()
    try {
      const issue = await getIssue(issueId, init)
      let project: ApiProject | null = null
      try {
        project = await getProject(issue.project_id, init)
      } catch {
        project = null
      }
      return { issue, project } satisfies IssuePageData
    } finally {
      done()
    }
  })

export const getNowPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const done = startTiming('getNowPageData')
    try {
      const doneFetch = startTiming('getNowPageData:getNow')
      const data = await getNow(await withServerInit())
      doneFetch()
      return data
    } finally {
      done()
    }
  },
)

export const getDraftsPageData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ApiNowIssue[]> => {
    const done = startTiming('getDraftsPageData')
    try {
      const data = await getNow(await withServerInit())
      return data.drafts
    } finally {
      done()
    }
  },
)

export const getProjectsPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const done = startTiming('getProjectsPageData')
    const init = await withServerInit()
    try {
      const doneProjects = startTiming('getProjectsPageData:listProjects')
      const projectTree = await listProjects(init)
      doneProjects()

      const flatProjects = flattenProjects(projectTree)

      const doneIssues = startTiming(
        `getProjectsPageData:listProjectIssues x${flatProjects.length}`,
      )
      const issueLists = await Promise.all(
        flatProjects.map(async (project) => [
          project.id,
          await listProjectIssues(project.id, undefined, init),
        ] as const),
      )
      doneIssues()

      return {
        projects: projectTree,
        issuesByProjectId: Object.fromEntries(issueLists),
      } satisfies ProjectsPageData
    } finally {
      done()
    }
  },
)

export const getProjectPageData = createServerFn({ method: 'GET', strict: false })
  .inputValidator((d: unknown) => d as { projectId: string })
  .handler(async ({ data }) => {
    const { projectId } = data
    const done = startTiming('getProjectPageData')
    const init = await withServerInit()
    try {
      const [project, issues] = await Promise.all([
        getProject(projectId, init),
        listProjectIssues(projectId, undefined, init),
      ])
      return { project, issues } as ProjectPageData
    } finally {
      done()
    }
  })

function flattenProjects(projects: ApiProject[]): ApiProject[] {
  return projects.flatMap((project) => [
    project,
    ...flattenProjects(project.sub_projects),
  ])
}

async function withServerInit(): Promise<RequestInit & { _baseUrl: string }> {
  // @ts-ignore - cloudflare:workers is a built-in module in the Workers runtime
  const { env } = await import('cloudflare:workers')
  const cfEnv = env as Record<string, string | undefined>
  const headers = new Headers()

  const cookie = getRequestHeader('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const authorization = getRequestHeader('authorization')
  if (authorization) {
    headers.set('authorization', authorization)
  }

  return {
    headers,
    _baseUrl: cfEnv.SERVER_API_BASE_URL ?? cfEnv.API_BASE_URL ?? '',
  }
}

function startTiming(label: string) {
  const start = performance.now()
  return () => {
    const ms = Math.round(performance.now() - start)
    console.log(`[timing] ${label}: ${ms}ms`)
  }
}
