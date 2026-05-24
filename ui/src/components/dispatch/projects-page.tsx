import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnimatedField } from '@/components/ui/animated-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PageHead } from './page-head'
import { ProjectGlyph, StatusPill } from './primitives'
import {
  createProject,
  listProjectIssues,
  listProjects,
} from '@/lib/api'

import { formatStatusLabel, pageCopy } from '../../data/dispatch'

import type { ApiIssue, ApiProject } from '@/lib/api'
import type { FormEvent } from 'react'

function validateProjectKey(value: string) {
  if (!value.trim()) {
    return 'Project key is required.'
  }

  if (!/^[A-Z0-9]+$/.test(value)) {
    return 'Use only uppercase letters and numbers.'
  }

  return null
}

function validateProjectName(value: string) {
  if (!value.trim()) {
    return 'Project name is required.'
  }

  return null
}

const NO_PARENT_PROJECT = '__none__'

export function ProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [issuesByProjectId, setIssuesByProjectId] = useState<Record<string, ApiIssue[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [color, setColor] = useState('#5b5bd6')
  const [parentId, setParentId] = useState('')

  const projectList = flattenProjects(projects)

  useEffect(() => {
    void loadProjects()
  }, [])

  async function loadProjects() {
    setIsLoading(true)
    setError(null)

    try {
      const projectTree = await listProjects()
      const flatProjects = flattenProjects(projectTree)
      const issueLists = await Promise.all(
        flatProjects.map(async ({ project }) => [
          project.id,
          await listProjectIssues(project.id),
        ] as const),
      )

      setProjects(projectTree)
      setIssuesByProjectId(Object.fromEntries(issueLists))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load projects.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)

    try {
      await createProject({
        name,
        key: keyValue,
        color,
        parent_id: parentId || undefined,
      })
      setIsDialogOpen(false)
      setName('')
      setKeyValue('')
      setColor('#5b5bd6')
      setParentId('')
      await loadProjects()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Failed to create project.',
      )
    } finally {
      setIsCreating(false)
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
          <section
            className="flex min-h-[190px] flex-col gap-4 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-[18px] shadow-[var(--dispatch-shadow-card)]"
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
                  {activeIssueCount(issuesByProjectId[project.id] ?? [])} active issues
                </p>
              </div>
            </div>
            <p className="m-0 text-[13px] leading-[1.55] text-[var(--dispatch-text-tertiary)]">
              {depth > 0 ? `Sub-project under level ${depth}.` : 'Top-level project.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill status={`${issuesByProjectId[project.id]?.length ?? 0} total`} />
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
                (issuesByProjectId[project.id] ?? []).slice(0, 4).map((issue) => (
                  <div
                    className="flex items-center gap-2.5"
                    key={issue.id}
                  >
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
          </section>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Add a project to the dispatch workspace. Issue creation stays out
              of scope here.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 [&_[class*='bg-card']]:bg-[var(--dispatch-bg-surface)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_[class*='border-primary']]:border-[var(--dispatch-cobalt-30)] [&_[class*='ring-primary']]:ring-[var(--dispatch-cobalt-30)]/20 [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]"
            onSubmit={handleCreateProject}
          >
            <AnimatedField
              id="project-name"
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Registry"
              validate={validateProjectName}
              required
            />
            <AnimatedField
              id="project-key"
              label="Key"
              value={keyValue}
              onChange={(value) => setKeyValue(value.toUpperCase())}
              placeholder="REG"
              maxLength={12}
              validate={validateProjectKey}
              required
            />
            <AnimatedField
              id="project-color"
              label="Color"
              type="color"
              value={color}
              onChange={setColor}
              inputClassName="min-h-11"
            />
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
                Parent project
              </span>
              <Select
                value={parentId || NO_PARENT_PROJECT}
                onValueChange={(value) => setParentId(value === NO_PARENT_PROJECT ? '' : value)}
              >
                <SelectTrigger className="h-11 w-full rounded-lg border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)] px-3 text-[var(--dispatch-text-primary)] data-[placeholder]:text-[var(--dispatch-text-tertiary)] [&_svg]:text-[var(--dispatch-text-tertiary)]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
                  <SelectItem
                    value={NO_PARENT_PROJECT}
                    className="text-[var(--dispatch-text-primary)] focus:bg-[var(--dispatch-bg-hover)] focus:text-[var(--dispatch-text-primary)]"
                  >
                    None
                  </SelectItem>
                  {projectList.map(({ project, depth }) => (
                    <SelectItem
                      key={project.id}
                      value={project.id}
                      className="text-[var(--dispatch-text-primary)] focus:bg-[var(--dispatch-bg-hover)] focus:text-[var(--dispatch-text-primary)]"
                    >
                      {`${'  '.repeat(depth)}${project.key} · ${project.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <DialogFooter className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)]">
              <Button
                variant="outline"
                type="button"
                className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isCreating} loadingText="Creating">
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function activeIssueCount(issues: ApiIssue[]) {
  return issues.filter((issue) => issue.status === 'doing' || issue.status === 'next').length
}

function flattenProjects(projects: ApiProject[], depth = 0): Array<{ project: ApiProject; depth: number }> {
  return projects.flatMap((project) => [
    { project, depth },
    ...flattenProjects(project.sub_projects, depth + 1),
  ])
}
