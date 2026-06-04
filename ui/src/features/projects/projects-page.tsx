import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { PageHead } from '../../components/dispatch/page-head'
import { ProjectCreateDialog } from '../../components/dispatch/ProjectCreateDialog'
import { ProjectGlyph, StatusPill } from '../../components/dispatch/primitives'
import { getDisplayErrorMessage } from '@/lib/api'
import { getProjectsPageData } from '@/lib/page-data'

import { formatStatusLabel, pageCopy } from '../../data/dispatch'

import type { ApiIssue, ApiProject } from '@/lib/api'
import type { ProjectsPageData } from '@/lib/page-data'

export function ProjectsPage({ data }: { data: ProjectsPageData }) {
  const [projects, setProjects] = useState<ApiProject[]>(data.projects)
  const [issuesByProjectId, setIssuesByProjectId] = useState<
    Partial<Record<string, ApiIssue[]>>
  >(data.issuesByProjectId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const projectList = flattenProjects(projects)

  async function loadProjects() {
    setIsLoading(true)
    setError(null)

    try {
      const nextData = await getProjectsPageData()
      setProjects(nextData.projects)
      setIssuesByProjectId(nextData.issuesByProjectId)
    } catch (loadError) {
      setError(getDisplayErrorMessage(loadError, 'Failed to load projects.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PageHead
        title={pageCopy.Projects.title}
        subtitle={pageCopy.Projects.subtitle}
        action={
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus size={14} />
            New project
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-[var(--dispatch-r-lg)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-4 py-3 text-[13px] text-[var(--dispatch-amber)]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-[13px] text-[var(--dispatch-text-tertiary)]">
          Loading projects…
        </div>
      ) : null}

      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {projectList.map(({ project, depth }) => (
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="flex min-h-[190px] flex-col gap-4 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-[18px] shadow-[var(--dispatch-shadow-card)] no-underline transition-colors hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)]"
            key={project.id}
          >
            <div className="flex items-center gap-2.5">
              <ProjectGlyph
                letter={project.key.charAt(0)}
                projectKey={project.key}
                color={project.color}
              />
              <div>
                <h2 className="m-0 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
                  {project.name}
                </h2>
                <p className="m-0 mt-px text-xs text-[var(--dispatch-text-tertiary)]">
                  {activeIssueCount(issuesByProjectId[project.id] ?? [])} active
                  issues
                </p>
              </div>
            </div>
            <p className="m-0 text-[13px] leading-[1.55] text-[var(--dispatch-text-tertiary)]">
              {depth > 0
                ? `Sub-project under level ${depth}.`
                : 'Top-level project.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill
                status={`${issuesByProjectId[project.id]?.length ?? 0} total`}
              />
              {project.sub_projects.length > 0 ? (
                <StatusPill status={`${project.sub_projects.length} child`} />
              ) : null}
            </div>
            <div className="mt-auto space-y-2.5 border-t border-[var(--dispatch-border-soft)] pt-3">
              <div className="text-[11px] font-semibold tracking-[0.1em] text-[var(--dispatch-text-quaternary)] uppercase">
                Issues
              </div>
              {(issuesByProjectId[project.id] ?? []).length === 0 ? (
                <p className="m-0 text-[13px] text-[var(--dispatch-text-tertiary)]">
                  No issues yet.
                </p>
              ) : (
                (issuesByProjectId[project.id] ?? [])
                  .slice(0, 4)
                  .map((issue) => (
                    <div className="flex items-center gap-2.5" key={issue.id}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[var(--dispatch-text-primary)]">
                          {issue.title}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-[var(--dispatch-text-tertiary)]">
                          {issue.key}
                        </div>
                      </div>
                      <StatusPill status={formatStatusLabel(issue.status)} />
                    </div>
                  ))
              )}
            </div>
          </Link>
        ))}
      </div>

      <ProjectCreateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreated={loadProjects}
      />
    </>
  )
}

export function ProjectsPageSkeleton() {
  return (
    <>
      <PageHead
        title={pageCopy.Projects.title}
        subtitle={pageCopy.Projects.subtitle}
        action={
          <Skeleton className="h-9 w-28 rounded-[var(--dispatch-r-md)] bg-[var(--dispatch-bg-hover)]" />
        }
      />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <section
            className="flex min-h-[190px] flex-col gap-4 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-[18px] shadow-[var(--dispatch-shadow-card)]"
            key={index}
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-10 rounded-[var(--dispatch-r-md)] bg-[var(--dispatch-bg-hover)]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 bg-[var(--dispatch-bg-hover)]" />
                <Skeleton className="h-3 w-20 bg-[var(--dispatch-bg-hover)]" />
              </div>
            </div>
            <Skeleton className="h-4 w-3/4 bg-[var(--dispatch-bg-hover)]" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full bg-[var(--dispatch-bg-hover)]" />
              <Skeleton className="h-6 w-14 rounded-full bg-[var(--dispatch-bg-hover)]" />
            </div>
            <div className="mt-auto space-y-2.5 border-t border-[var(--dispatch-border-soft)] pt-3">
              <Skeleton className="h-3 w-12 bg-[var(--dispatch-bg-hover)]" />
              {Array.from({ length: 3 }).map((__, issueIndex) => (
                <div className="flex items-center gap-2.5" key={issueIndex}>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-4/5 bg-[var(--dispatch-bg-hover)]" />
                    <Skeleton className="h-3 w-1/3 bg-[var(--dispatch-bg-hover)]" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full bg-[var(--dispatch-bg-hover)]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function activeIssueCount(issues: ApiIssue[]) {
  return issues.filter(
    (issue) => issue.status === 'doing' || issue.status === 'next',
  ).length
}

function flattenProjects(
  projects: ApiProject[],
  depth = 0,
): Array<{ project: ApiProject; depth: number }> {
  return projects.flatMap((project) => [
    { project, depth },
    ...flattenProjects(project.sub_projects, depth + 1),
  ])
}
