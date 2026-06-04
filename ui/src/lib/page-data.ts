import {
  getNow,
  getHealth,
  getIssue,
  getProject,
  listProjectIssues,
  listProjects,
} from './api'

import type { ApiHealth, ApiIssue, ApiNowIssue, ApiProject } from './api'

export type SettingsPageData = {
  health: ApiHealth
  uiCommitHash: string
}

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

export async function getIssuePageData({
  issueId,
}: {
  issueId: string
}): Promise<IssuePageData> {
  const issue = await getIssue(issueId)
  let project: ApiProject | null = null
  try {
    project = await getProject(issue.project_id)
  } catch {
    project = null
  }
  return { issue, project }
}

export function getNowPageData() {
  return getNow()
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const health = await getHealth()
  return {
    health,
    uiCommitHash: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
  }
}

export async function getDraftsPageData(): Promise<ApiNowIssue[]> {
  const data = await getNow()
  return data.drafts
}

export async function getProjectsPageData(): Promise<ProjectsPageData> {
  const projectTree = await listProjects()
  const flatProjects = flattenProjects(projectTree)
  const issueLists = await Promise.all(
    flatProjects.map(
      async (project) =>
        [project.id, await listProjectIssues(project.id)] as const,
    ),
  )

  return {
    projects: projectTree,
    issuesByProjectId: Object.fromEntries(issueLists),
  }
}

export async function getProjectPageData({
  projectId,
}: {
  projectId: string
}): Promise<ProjectPageData> {
  const [project, issues] = await Promise.all([
    getProject(projectId),
    listProjectIssues(projectId),
  ])
  return { project, issues }
}

function flattenProjects(projects: ApiProject[]): ApiProject[] {
  return projects.flatMap((project) => [
    project,
    ...flattenProjects(project.sub_projects),
  ])
}
