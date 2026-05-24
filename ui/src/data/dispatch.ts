import type { ReactNode } from 'react'

export type ProjectKey = 's' | 'r' | 'v'
export type Status = 'Doing' | 'Next' | 'Done' | 'Draft'
export type DispatchPage =
  | 'Now'
  | 'Inbox'
  | 'Projects'
  | 'Drafts'
  | 'Settings'

export type Issue = {
  title: string
  sub: string
  project: string
  projectKey: ProjectKey
  status: Status
  priority?: string
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

export const inboxIssues: Issue[] = [
  {
    title: 'Review deployment timeline screenshot',
    sub: 'Confirm the agent output maps to visible milestones',
    project: 'Strophe',
    projectKey: 's',
    status: 'Next',
    dot: 'cobalt',
  },
  {
    title: 'Triage duplicate OAuth callback report',
    sub: 'Two user reports appear to share the same redirect root',
    project: 'Vault',
    projectKey: 'v',
    status: 'Next',
    dot: 'amber',
  },
  {
    title: 'Confirm new registry cleanup window',
    sub: 'Ops asked whether nightly cleanup can move to 03:00',
    project: 'Registry',
    projectKey: 'r',
    status: 'Draft',
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
  Inbox: {
    title: 'Inbox',
    subtitle: 'Newly captured work before it has a reliable shape.',
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
