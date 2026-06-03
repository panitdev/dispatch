import type { ReactNode } from 'react'

export type ProjectKey = string
export type Status = string
export type DispatchPage =
  | 'Now'
  | 'Projects'
  | 'Drafts'
  | 'Settings'
  | 'Issue'

export type Issue = {
  id?: string
  key?: string
  projectId?: string
  title: string
  sub: string
  project: string
  projectKey: ProjectKey
  projectColor?: string
  status: Status
  priority?: number
  labels?: string[]
  active?: boolean
  dot?: 'cobalt' | 'amber' | 'empty'
}

export type Section = {
  title: string
  tone?: 'cobalt' | 'amber' | 'muted'
  icon: ReactNode
  issues: Issue[]
}

export const continueIssues: Issue[] = [
  {
    title: 'Deployment retry state model',
    sub: 'Decide how deployment records represent attempts vs instances',
    project: 'Strophe',
    projectKey: 's',
    status: 'Doing',
    active: true,
    dot: 'cobalt',
  },
  {
    title: 'Logo alpha edge cleanup',
    sub: 'Refine mask to reduce halo on dark backgrounds',
    project: 'Registry',
    projectKey: 'r',
    status: 'Next',
  },
]

export const dueIssues: Issue[] = [
  {
    title: 'Kratos return_to handling',
    sub: 'Validate allowlist + fallback behavior',
    project: 'Vault',
    projectKey: 'v',
    status: 'Next',
    dot: 'amber',
  },
  {
    title: 'Secrets import flow',
    sub: 'Add preview + conflict detection',
    project: 'Vault',
    projectKey: 'v',
    status: 'Next',
    dot: 'amber',
  },
]

export const recentIssues: Issue[] = [
  {
    title: 'Registry deployment cleanup',
    sub: 'Remove old jobs, volumes, and dangling images',
    project: 'Registry',
    projectKey: 'r',
    status: 'Done',
  },
  {
    title: 'Auth redirect testing',
    sub: 'Cypress coverage for OAuth flows',
    project: 'Vault',
    projectKey: 'v',
    status: 'Done',
  },
  {
    title: 'DB schema review',
    sub: 'Add index for deployment_events',
    project: 'Strophe',
    projectKey: 's',
    status: 'Done',
  },
]

export const draftIssues: Issue[] = [
  {
    title: 'SOC2 evidence review',
    sub: 'Blocked on auditor reply',
    project: 'Vault',
    projectKey: 'v',
    status: 'Draft',
    dot: 'amber',
  },
  {
    title: 'Registry storage class migration',
    sub: 'Needs a rollout plan before it should enter active work',
    project: 'Registry',
    projectKey: 'r',
    status: 'Draft',
  },
  {
    title: 'Deployment timeline screenshots',
    sub: 'Capture a cleaner before/after sequence for the overview deck',
    project: 'Strophe',
    projectKey: 's',
    status: 'Draft',
  },
]

export const pageCopy: Record<
  DispatchPage,
  { title: string; subtitle: string }
> = {
  Now: {
    title: 'Now',
    subtitle: 'Resume the right work without overload.',
  },
  Projects: {
    title: 'Projects',
    subtitle: 'Keep active work grouped by the product surface it affects.',
  },
  Drafts: {
    title: 'Drafts',
    subtitle: 'Work that is captured, shaped, and not ready to pull forward yet.',
  },
  Settings: {
    title: 'Settings',
    subtitle: 'Tune capture defaults and lightweight routing behavior.',
  },
}

export function formatStatusLabel(status: string) {
  if (!status) {
    return 'Unknown'
  }

  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}
