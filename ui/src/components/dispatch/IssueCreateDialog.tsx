import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Maximize2,
  X,
  Paperclip,
  Tag,
  FolderOpen,
  CircleDot,
  Check,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
} from '#/components/ui/responsive-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'

import { IssueEditor } from './IssueEditor'
import { createIssue, getDisplayErrorMessage, listProjects } from '#/lib/api'
import { toast } from 'sonner'

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

function MetaChip({
  icon,
  label,
  onClick,
  active,
  children,
}: {
  icon: React.ReactNode
  label?: string
  onClick?: () => void
  active?: boolean
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-[var(--dispatch-r-sm)] px-2.5 py-1 text-[13px] font-medium transition-colors',
        'border border-transparent',
        active
          ? 'border-[var(--dispatch-border)] bg-[var(--dispatch-bg-hover)] text-[var(--dispatch-text-primary)]'
          : 'text-[var(--dispatch-text-tertiary)] hover:border-[var(--dispatch-border)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-secondary)]',
      ].join(' ')}
    >
      {icon}
      {label && <span>{label}</span>}
      {children}
    </button>
  )
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
  const [projectOpen, setProjectOpen] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    listProjects()
      .then((tree) => {
        setProjects(tree)
        if (!projectId && tree.length > 0) {
          setProjectId(tree[0].id)
        }
      })
      .catch(() => { })
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open])

  const projectList = flattenProjects(projects)
  const selectedProject = projectList.find((p) => p.project.id === projectId)?.project

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
        blocks,
      })
      setTitle('')
      setBlocks([])
      onCreated?.()
      onOpenChange(false)
      toast.success('Issue created')
    } catch (err) {
      setError(getDisplayErrorMessage(err, 'Failed to create issue.'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        drawerContentClassName="h-[100dvh] max-h-none rounded-none border-0"
        className="dispatch-theme flex flex-1 sm:max-h-[88vh] w-full max-w-2xl sm:max-w-2xl flex-col gap-0 overflow-hidden border-[var(--dispatch-border-strong)] p-0 text-[var(--dispatch-text-primary)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1.5 text-[13px]">
            {selectedProject ? (
              <>
                <span className="rounded border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-hover)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--dispatch-text-secondary)]">
                  {selectedProject.key}
                </span>
                <ChevronRight
                  size={12}
                  className="text-[var(--dispatch-text-quaternary)]"
                />
                <span className="font-medium text-[var(--dispatch-text-primary)]">New issue</span>
              </>
            ) : (
              <span className="font-medium text-[var(--dispatch-text-primary)]">New issue</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Expand"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--dispatch-text-quaternary)] transition-colors hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-tertiary)]"
            >
              <Maximize2 size={13} />
            </button>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--dispatch-text-quaternary)] transition-colors hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-tertiary)]"
              >
                <X size={13} />
              </button>
            </DialogClose>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {error ? (
              <div className="mx-5 mb-2 rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
                {error}
              </div>
            ) : null}

            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
              className="w-full bg-transparent px-5 pt-2 pb-2 text-[22px] font-medium text-[var(--dispatch-text-primary)] placeholder:text-[var(--dispatch-text-tertiary)] outline-none"
              required
            />

            {/* Editor */}
            <div className="px-5 pb-4">
              <IssueEditor
                initialBlocks={[]}
                placeholder="Write a description..."
                onChange={setBlocks}
              />
            </div>
          </div>

          {/* Bottom bar — metadata chips + actions in one row */}
          <div className="flex shrink-0 items-center gap-1.5 px-4 py-3">
            <Button size="icon-sm" variant="outline">
              <Paperclip size={14} />
            </Button>

            <Button size="sm" variant="outline">
              Draft
            </Button>

            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <FolderOpen size={12} />
                  {selectedProject ? `${selectedProject.key} · ${selectedProject.name}` : 'Project'}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="dispatch-theme w-56 rounded-[var(--dispatch-r-lg)] border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-1.5 text-[var(--dispatch-text-primary)] shadow-[var(--dispatch-shadow-pop)]"
              >
                <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dispatch-text-quaternary)]">
                  Project
                </div>
                {projectList.map(({ project, depth }) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setProjectId(project.id)
                      setProjectOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-[var(--dispatch-r-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)]"
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                  >
                    <span className="flex-1 truncate">
                      <span className="text-[var(--dispatch-text-tertiary)]">{project.key}</span>
                      {' · '}
                      {project.name}
                    </span>
                    {project.id === projectId && (
                      <Check size={12} className="shrink-0 text-[var(--dispatch-cobalt-bright)]" />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Button size="sm" variant="outline">
              <Tag size={12} />
              Labels
            </Button>

            <div className="flex-1" />

            <Button
              type="submit"
              size="sm"
              className="rounded-[var(--dispatch-r-lg)] border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]/90"
              disabled={!title.trim() || !projectId}
              loading={isCreating}
              loadingText="Creating…"
            >
              <p className="text-sm">
                Create issue
              </p>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
