import { forwardRef, useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Maximize2,
  X,
  User,
  Tag,
  MoreHorizontal,
  FolderOpen,
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
import { createIssue, getDisplayErrorMessage, getMe, listProjects } from '#/lib/api'
import { toast } from 'sonner'
import { StatusCircle } from './primitives'

import type { IssueBodyBlock } from './IssueEditor'
import type { ApiProject, ApiUser } from '#/lib/api'

interface IssueCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  defaultProjectId?: string
}

const STATUSES = ['Draft', 'Next', 'Doing', 'Done', 'Cancelled'] as const
const LABELS = ['bug', 'feature', 'improvement', 'docs'] as const

function flattenProjects(
  projects: ApiProject[],
  depth = 0,
): Array<{ project: ApiProject; depth: number }> {
  return projects.flatMap((project) => [
    { project, depth },
    ...flattenProjects(project.sub_projects, depth + 1),
  ])
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const MetaChip = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode
    label?: string
    active?: boolean
    children?: React.ReactNode
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MetaChip({ icon, label, active, children, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={[
        'inline-flex items-center gap-1.5 rounded-[var(--dispatch-r-sm)] px-2 py-1 text-[12px] font-medium transition-colors',
        'border border-transparent',
        active
          ? 'border-[var(--dispatch-border)] bg-[var(--dispatch-bg-hover)] text-[var(--dispatch-text-primary)]'
          : 'text-[var(--dispatch-text-tertiary)] hover:border-[var(--dispatch-border)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-secondary)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon}
      {label && <span>{label}</span>}
      {children}
    </button>
  )
})

const POPOVER_CONTENT_CLS =
  'dispatch-theme w-52 rounded-[var(--dispatch-r-lg)] border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-1.5 text-[var(--dispatch-text-primary)] shadow-[var(--dispatch-shadow-pop)]'

const MENU_SECTION_LABEL_CLS =
  'mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dispatch-text-quaternary)]'

const MENU_ITEM_CLS =
  'flex w-full items-center gap-2 rounded-[var(--dispatch-r-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)]'

export function IssueCreateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultProjectId,
}: IssueCreateDialogProps) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [status, setStatus] = useState('draft')
  const [labels, setLabels] = useState<string[]>([])
  const [assignee, setAssignee] = useState<ApiUser | null>(null)
  const [me, setMe] = useState<ApiUser | null>(null)
  const [blocks, setBlocks] = useState<IssueBodyBlock[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projectOpen, setProjectOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)

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
      .catch(() => {})
    getMe()
      .then(setMe)
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open])

  const projectList = flattenProjects(projects)
  const selectedProject = projectList.find((p) => p.project.id === projectId)?.project

  function toggleLabel(label: string) {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    setIsCreating(true)
    setError(null)

    try {
      await createIssue({
        project_id: projectId,
        title: title.trim(),
        status,
        labels,
        assignee_id: assignee?.id ?? null,
        blocks,
      })
      setTitle('')
      setBlocks([])
      setStatus('draft')
      setLabels([])
      setAssignee(null)
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
        className="dispatch-theme flex flex-1 sm:max-h-[88vh] w-full max-w-2xl sm:max-w-2xl flex-col gap-0 overflow-hidden border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-0 text-[var(--dispatch-text-primary)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1 text-[13px]">
            {selectedProject ? (
              <>
                <span className="font-medium text-[var(--dispatch-text-secondary)]">
                  {selectedProject.key}
                </span>
                <ChevronRight
                  size={12}
                  className="text-[var(--dispatch-text-quaternary)]"
                />
                <span className="text-[var(--dispatch-text-secondary)]">New issue</span>
              </>
            ) : (
              <span className="text-[var(--dispatch-text-secondary)]">New issue</span>
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
              className="w-full bg-transparent px-5 pt-1 pb-3 text-[21px] font-semibold text-[var(--dispatch-text-primary)] placeholder:text-[var(--dispatch-text-quaternary)] outline-none"
              required
            />

            {/* Editor */}
            <div className="px-5 pb-4">
              <IssueEditor onChange={setBlocks} />
            </div>
          </div>

          {/* Metadata chips */}
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-[var(--dispatch-border-soft)] px-4 py-2.5">
            {/* Status */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <MetaChip
                  icon={<StatusCircle status={status} className="size-3 shrink-0" />}
                  label={capitalize(status)}
                  active
                />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className={POPOVER_CONTENT_CLS}>
                <div className={MENU_SECTION_LABEL_CLS}>Status</div>
                {STATUSES.map((s) => {
                  const value = s.toLowerCase()
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatus(value)
                        setStatusOpen(false)
                      }}
                      className={MENU_ITEM_CLS}
                    >
                      <StatusCircle status={value} className="size-[14px] shrink-0" />
                      <span className="flex-1">{s}</span>
                      {value === status && (
                        <Check
                          size={12}
                          className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                        />
                      )}
                    </button>
                  )
                })}
              </PopoverContent>
            </Popover>

            {/* Assignee */}
            <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <MetaChip
                  icon={<User size={12} />}
                  label={assignee ? assignee.username : 'Assignee'}
                  active={!!assignee}
                />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className={POPOVER_CONTENT_CLS}>
                <div className={MENU_SECTION_LABEL_CLS}>Assignee</div>
                <button
                  type="button"
                  onClick={() => {
                    setAssignee(null)
                    setAssigneeOpen(false)
                  }}
                  className={MENU_ITEM_CLS}
                >
                  <User size={14} className="shrink-0 text-[var(--dispatch-text-tertiary)]" />
                  <span className="flex-1">Unassigned</span>
                  {!assignee && (
                    <Check
                      size={12}
                      className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                    />
                  )}
                </button>
                {me && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignee(me)
                      setAssigneeOpen(false)
                    }}
                    className={MENU_ITEM_CLS}
                  >
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--dispatch-cobalt-12)] text-[10px] font-bold text-[var(--dispatch-cobalt-bright)]">
                      {me.initials}
                    </span>
                    <span className="flex-1 truncate">{me.username}</span>
                    {assignee?.id === me.id && (
                      <Check
                        size={12}
                        className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                      />
                    )}
                  </button>
                )}
              </PopoverContent>
            </Popover>

            {/* Project */}
            <Popover open={projectOpen} onOpenChange={setProjectOpen}>
              <PopoverTrigger asChild>
                <MetaChip
                  icon={<FolderOpen size={12} />}
                  label={
                    selectedProject
                      ? `${selectedProject.key} · ${selectedProject.name}`
                      : 'Project'
                  }
                  active={!!selectedProject}
                />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className={POPOVER_CONTENT_CLS}>
                <div className={MENU_SECTION_LABEL_CLS}>Project</div>
                {projectList.map(({ project, depth }) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setProjectId(project.id)
                      setProjectOpen(false)
                    }}
                    className={MENU_ITEM_CLS}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                  >
                    <span className="flex-1 truncate">
                      <span className="text-[var(--dispatch-text-tertiary)]">{project.key}</span>
                      {' · '}
                      {project.name}
                    </span>
                    {project.id === projectId && (
                      <Check
                        size={12}
                        className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                      />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Labels */}
            <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
              <PopoverTrigger asChild>
                <MetaChip
                  icon={<Tag size={12} />}
                  label={labels.length > 0 ? labels.map(capitalize).join(', ') : 'Labels'}
                  active={labels.length > 0}
                />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className={POPOVER_CONTENT_CLS}>
                <div className={MENU_SECTION_LABEL_CLS}>Labels</div>
                {LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLabel(label)}
                    className={MENU_ITEM_CLS}
                  >
                    <span className="flex-1">{capitalize(label)}</span>
                    {labels.includes(label) && (
                      <Check
                        size={12}
                        className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                      />
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--dispatch-r-sm)] border border-transparent px-2 py-1 text-[12px] font-medium text-[var(--dispatch-text-tertiary)] transition-colors hover:border-[var(--dispatch-border)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-secondary)]"
            >
              <MoreHorizontal size={12} />
            </button>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center gap-3 border-t border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-4 py-3">
            <div className="flex-1" />

            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || !projectId}
              loading={isCreating}
              loadingText="Creating…"
            >
              Create issue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
