import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { AnimatedField } from '#/components/ui/animated-field'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

import { IssueEditor } from './IssueEditor'
import { createIssue, getDisplayErrorMessage, listProjects } from '#/lib/api'

import type { IssueBodyBlock } from './IssueEditor'
import type { ApiProject } from '#/lib/api'

interface IssueCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  defaultProjectId?: string
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

export function IssueCreateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId,
}: IssueCreateDialogProps) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [blocks, setBlocks] = useState<IssueBodyBlock[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listProjects()
      .then((tree) => {
        setProjects(tree)
        if (!projectId && tree.length > 0) {
          setProjectId(tree[0].id)
        }
      })
      .catch(() => {})
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    setIsCreating(true)
    setError(null)

    try {
      await createIssue({
        project_id: projectId,
        title: title.trim(),
        status: 'draft',
        blocks: blocks as unknown[],
      })
      setTitle('')
      setBlocks([])
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      setError(getDisplayErrorMessage(err, 'Failed to create issue.'))
    } finally {
      setIsCreating(false)
    }
  }

  const projectList = flattenProjects(projects)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dispatch-theme flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-0 text-[var(--dispatch-text-primary)]">
        <DialogHeader className="shrink-0 border-b border-[var(--dispatch-border-soft)] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
            <Plus size={15} className="text-[var(--dispatch-cobalt-bright)]" />
            New issue
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {error ? (
              <div className="rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
                {error}
              </div>
            ) : null}

            <div className="[&_[class*='bg-card']]:bg-[var(--dispatch-bg-surface)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_[class*='border-primary']]:border-[var(--dispatch-cobalt-30)] [&_[class*='ring-primary']]:ring-[var(--dispatch-cobalt-30)]/20 [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]">
              <AnimatedField
                id="issue-title"
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Describe the issue in one line"
                required
              />
            </div>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
                Project
              </span>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-11 w-full rounded-lg border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)] px-3 text-[var(--dispatch-text-primary)] data-[placeholder]:text-[var(--dispatch-text-tertiary)] [&_svg]:text-[var(--dispatch-text-tertiary)]">
                  <SelectValue placeholder="Select project…" />
                </SelectTrigger>
                <SelectContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
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

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
                Body
              </span>
              <div className="min-h-[200px] rounded-[var(--dispatch-r-lg)] border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)] px-4 py-3 focus-within:border-[var(--dispatch-cobalt-30)] focus-within:ring-2 focus-within:ring-[var(--dispatch-cobalt-30)]/20 transition-[border-color,box-shadow]">
                <IssueEditor onChange={setBlocks} />
              </div>
            </div>
          </div>

          <DialogFooter className="-mx-0 shrink-0 rounded-b-xl border-t border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-5 py-3 [&]:sm:flex-row [&]:sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !projectId}
              loading={isCreating}
              loadingText="Creating…"
            >
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
