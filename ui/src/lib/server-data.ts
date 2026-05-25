import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

import {
  getNow,
  getProject,
  listProjectIssues,
  listProjects,
} from './api'

import type { ApiIssue, ApiProject } from './api'

export type ProjectsPageData = {
  projects: ApiProject[]
  issuesByProjectId: Record<string, ApiIssue[]>
}

export type ProjectPageData = {
  project: ApiProject
  issues: ApiIssue[]
}

export const getNowPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const done = startTiming('getNowPageData')
    try {
      const doneFetch = startTiming('getNowPageData:getNow')
      const data = await getNow(withForwardedAuthHeaders())
      doneFetch()
      return data
    } finally {
      done()
    }
  },
)

export const getProjectsPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const done = startTiming('getProjectsPageData')
    const init = withForwardedAuthHeaders()
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
    const init = withForwardedAuthHeaders()
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

function withForwardedAuthHeaders(): RequestInit {
  const headers = new Headers()

  const cookie = getRequestHeader('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const authorization = getRequestHeader('authorization')
  if (authorization) {
    headers.set('authorization', authorization)
  }

  return { headers }
}

function startTiming(label: string) {
  const start = performance.now()
  return () => {
    const ms = Math.round(performance.now() - start)
    console.log(`[timing] ${label}: ${ms}ms`)
  }
}
