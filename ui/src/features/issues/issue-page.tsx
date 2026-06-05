import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  Pencil,
} from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { MarkdownContent } from '@/components/dispatch/markdown-content'
import { formatStatusLabel } from '@/data/dispatch'

import {
  ProjectGlyph,
  StatusCircle,
  StatusPill,
} from '../../components/dispatch/primitives'
import { IssueEditor } from '../../components/dispatch/IssueEditor'

import {
  getDisplayErrorMessage,
  listProjectLabels,
  updateIssue,
} from '@/lib/api'
import { toast } from 'sonner'

import type React from 'react'
import type { ApiIssue, UpdateIssueInput } from '@/lib/api'
import type { IssueBodyBlock } from '../../components/dispatch/IssueEditor'
import type { IssuePageData } from '@/lib/page-data'

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

const PRIORITY_OPTIONS = [0, 1, 2, 3, 4]

const STATUSES = ['doing', 'next', 'draft', 'done', 'cancelled']

function PriorityDots({ priority }: { priority: number }) {
  const heights =
    priority === 1
      ? [10, 10, 10]
      : priority === 2
        ? [10, 7, 3]
        : priority === 3
          ? [6, 6, 3]
          : priority === 4
            ? [3, 3, 3]
            : [3, 6, 10]

  const hasPriority = priority > 0
  const color =
    priority === 1
      ? 'var(--dispatch-rust)'
      : hasPriority
        ? 'var(--dispatch-text-secondary)'
        : 'var(--dispatch-text-quaternary)'

  return (
    <svg
      width="12"
      height="10"
      viewBox="0 0 12 10"
      className="shrink-0"
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 4 + 0.5}
          y={10 - h}
          width="3"
          height={h}
          rx="0.75"
          fill={color}
          opacity={hasPriority ? 1 : 0.4}
        />
      ))}
    </svg>
  )
}

// ─── Label pill ───────────────────────────────────────────────────────────────

function labelColorStyle(label: string): React.CSSProperties {
  const hash = label
    .split('')
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0)
  const palettes: React.CSSProperties[] = [
    {
      background: 'var(--dispatch-cobalt-12)',
      borderColor: 'var(--dispatch-cobalt-30)',
      color: 'var(--dispatch-cobalt-bright)',
    },
    {
      background: 'var(--dispatch-green-12)',
      borderColor: 'var(--dispatch-green-30)',
      color: 'var(--dispatch-green-text)',
    },
    {
      background: 'var(--dispatch-amber-12)',
      borderColor: 'var(--dispatch-amber-30)',
      color: 'var(--dispatch-amber)',
    },
    {
      background: 'var(--dispatch-rust-12)',
      borderColor: 'var(--dispatch-rust-30)',
      color: 'var(--dispatch-rust)',
    },
    {
      background: 'var(--dispatch-bg-elevated)',
      borderColor: 'var(--dispatch-border)',
      color: 'var(--dispatch-text-secondary)',
    },
  ]
  return palettes[hash % palettes.length]
}

function LabelPill({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[4px] border px-[6px] py-[2px] text-[11px] font-medium leading-[1.4]"
      style={labelColorStyle(label)}
    >
      {label}
    </span>
  )
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${Math.max(diffMins, 0)}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

// ─── Property row ─────────────────────────────────────────────────────────────

function PropertyRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[32px] items-center gap-3 py-1">
      <span className="w-[72px] shrink-0 text-[12px] text-[var(--dispatch-text-tertiary)]">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

// ─── Editable property row (wraps a Popover trigger) ─────────────────────────

function EditablePropertyRow({
  label,
  children,
  open,
  onOpenChange,
  popoverContent,
}: {
  label: string
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  popoverContent: React.ReactNode
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mx-1 flex min-h-[32px] w-[calc(100%+8px)] cursor-pointer items-center gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-[var(--dispatch-bg-hover)]"
        >
          <span className="w-[72px] shrink-0 text-[12px] text-[var(--dispatch-text-tertiary)]">
            {label}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {children}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="dispatch-theme w-44 rounded-[var(--dispatch-r-lg)] border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-1.5 text-[var(--dispatch-text-primary)] shadow-[var(--dispatch-shadow-pop)]"
      >
        {popoverContent}
      </PopoverContent>
    </Popover>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IssuePage({ data }: { data: IssuePageData }) {
  const { project } = data
  const [issue, setIssue] = useState<ApiIssue>(data.issue)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingBody, setEditingBody] = useState(false)
  const [bodyDraft, setBodyDraft] = useState<IssueBodyBlock[]>([])
  const [savingBody, setSavingBody] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<string[]>([])

  const titleRef = useRef<HTMLTextAreaElement>(null)

  const visibleBlocks = issue.blocks.filter(
    (block) => block.content.trim() || block.title?.trim(),
  )
  const projectName = project?.name ?? `Project ${issue.project_id}`
  const projectKey = project?.key ?? issue.project_id

  useEffect(() => {
    listProjectLabels(issue.project_id)
      .then((rows) => setAvailableLabels(rows.map((l) => l.name)))
      .catch(() => {})
  }, [issue.project_id])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      const el = titleRef.current
      el.focus()
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editingTitle])

  async function save(patch: UpdateIssueInput) {
    try {
      const updated = await updateIssue(issue.id, patch)
      setIssue(updated)
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to save.'))
    }
  }

  function startEditingTitle() {
    setTitleDraft(issue.title)
    setEditingTitle(true)
  }

  async function commitTitle() {
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (trimmed && trimmed !== issue.title) {
      await save({ title: trimmed })
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitTitle()
    } else if (e.key === 'Escape') {
      setEditingTitle(false)
    }
  }

  function startEditingBody() {
    setBodyDraft(issue.blocks as IssueBodyBlock[])
    setEditingBody(true)
  }

  async function commitBody() {
    setSavingBody(true)
    try {
      const updated = await updateIssue(issue.id, { blocks: bodyDraft })
      setIssue(updated)
      setEditingBody(false)
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to save body.'))
    } finally {
      setSavingBody(false)
    }
  }

  function cancelBody() {
    setEditingBody(false)
  }

  const statusPopover = (
    <>
      <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dispatch-text-quaternary)]">
        Status
      </div>
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => {
            setStatusOpen(false)
            if (s !== issue.status.toLowerCase()) void save({ status: s })
          }}
          className="flex w-full items-center gap-2 rounded-[var(--dispatch-r-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)]"
        >
          <StatusCircle status={s} className="size-[14px] shrink-0" />
          <span className="flex-1 truncate">{formatStatusLabel(s)}</span>
          {s === issue.status.toLowerCase() && (
            <Check
              size={12}
              className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
            />
          )}
        </button>
      ))}
    </>
  )

  const priorityPopover = (
    <>
      <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dispatch-text-quaternary)]">
        Priority
      </div>
      {PRIORITY_OPTIONS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => {
            setPriorityOpen(false)
            if (p !== issue.priority) void save({ priority: p })
          }}
          className="flex w-full items-center gap-2 rounded-[var(--dispatch-r-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)]"
        >
          <PriorityDots priority={p} />
          <span className="flex-1 truncate">
            {PRIORITY_LABELS[p] ?? 'No priority'}
          </span>
          {p === issue.priority && (
            <Check
              size={12}
              className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
            />
          )}
        </button>
      ))}
    </>
  )

  const labelsPopover = (
    <>
      <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--dispatch-text-quaternary)]">
        Labels
      </div>
      {availableLabels.length > 0 ? (
        availableLabels.map((label) => {
          const selected = issue.labels.includes(label)
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                const next = selected
                  ? issue.labels.filter((l) => l !== label)
                  : [...issue.labels, label]
                void save({ labels: next })
              }}
              className="flex w-full items-center gap-2 rounded-[var(--dispatch-r-sm)] px-2 py-1.5 text-left text-[13px] text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)]"
            >
              <span className="flex-1 truncate">{label}</span>
              {selected && (
                <Check
                  size={12}
                  className="shrink-0 text-[var(--dispatch-cobalt-bright)]"
                />
              )}
            </button>
          )
        })
      ) : (
        <p className="px-2 py-1 text-[12px] text-[var(--dispatch-text-quaternary)]">
          No labels in this project.
        </p>
      )}
    </>
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: issue content */}
      <div className="min-w-0 flex-1 overflow-y-auto px-[18px] pb-20 pt-[22px] md:px-10 md:pt-7">
        <div className="mx-auto max-w-[680px]">
          {/* Issue key */}
          <div className="mb-5 flex items-center gap-2 text-xs text-[var(--dispatch-text-quaternary)]">
            <span className="font-mono font-medium tracking-[0.04em]">
              {issue.key}
            </span>
            <span className="h-3 w-px bg-[var(--dispatch-border-soft)]" />
            <span className="truncate">{issue.id}</span>
          </div>

          {/* Title */}
          {editingTitle ? (
            <textarea
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onBlur={() => void commitTitle()}
              onKeyDown={handleTitleKeyDown}
              rows={1}
              className="m-0 mb-5 w-full resize-none overflow-hidden border-0 border-b border-[var(--dispatch-border-soft)] bg-transparent pb-1 font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.015em] text-[var(--dispatch-text-primary)] outline-none focus:border-[var(--dispatch-cobalt-bright)]"
            />
          ) : (
            <h1
              className="group m-0 mb-5 cursor-text font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.015em] text-[var(--dispatch-text-primary)]"
              onClick={startEditingTitle}
              title="Click to edit title"
            >
              {issue.title}
              <Pencil
                size={14}
                className="-mt-1 ml-2 inline-block align-middle text-[var(--dispatch-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-40"
              />
            </h1>
          )}

          {/* Status + chips (shown on smaller screens where properties panel is hidden) */}
          <div className="mb-5 flex flex-wrap gap-1.5 lg:hidden">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] py-[3px] pr-2 pl-[3px] text-xs font-medium text-[var(--dispatch-text-secondary)]">
              <ProjectGlyph
                letter={projectName.charAt(0)}
                projectKey={projectKey}
                color={project?.color}
                small
              />
              <span className="pr-0.5">{projectName}</span>
            </span>
            <StatusPill status={formatStatusLabel(issue.status)} />
            {issue.labels.map((label) => (
              <LabelPill key={label} label={label} />
            ))}
          </div>

          <div className="mb-6 h-px bg-[var(--dispatch-border-soft)]" />

          {/* Body blocks */}
          {editingBody ? (
            <div className="flex flex-col gap-4">
              <IssueEditor
                key={`body-${issue.id}`}
                initialBlocks={bodyDraft}
                placeholder="Write a description..."
                onChange={setBodyDraft}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void commitBody()}
                  loading={savingBody}
                  loadingText="Saving…"
                  className="rounded-[var(--dispatch-r-lg)] border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]/90"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelBody}
                  disabled={savingBody}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="group/body">
              {visibleBlocks.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {visibleBlocks.map((block) =>
                    block.kind === 'markdown' ? (
                      <MarkdownContent
                        key={block.id}
                        markdown={block.content}
                        className="text-[13.5px] leading-[1.6] text-[var(--dispatch-text-secondary)]"
                      />
                    ) : (
                      <section
                        key={block.id}
                        className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-[var(--dispatch-text-secondary)]"
                      >
                        <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--dispatch-text-primary)] [&_svg]:text-[var(--dispatch-cobalt-bright)]">
                          {block.kind === 'action' ? (
                            <ArrowRight size={15} />
                          ) : (
                            <BookOpen size={15} />
                          )}
                          {block.title ?? formatStatusLabel(block.kind)}
                        </div>
                        {block.content.trim() ? (
                          <MarkdownContent markdown={block.content} />
                        ) : null}
                      </section>
                    ),
                  )}
                </div>
              ) : (
                <section className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-[var(--dispatch-text-secondary)]">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--dispatch-text-primary)] [&_svg]:text-[var(--dispatch-cobalt-bright)]">
                    <BookOpen size={15} />
                    Body
                  </div>
                  <p className="m-0 text-[var(--dispatch-text-tertiary)]">
                    No body content yet.
                  </p>
                </section>
              )}
              <button
                type="button"
                onClick={startEditingBody}
                className="mt-5 flex items-center gap-1.5 text-[12px] text-[var(--dispatch-text-quaternary)] opacity-0 transition-opacity hover:text-[var(--dispatch-text-tertiary)] group-hover/body:opacity-100"
              >
                <Pencil size={11} />
                Edit body
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: properties panel */}
      <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-l border-[var(--dispatch-border-soft)] px-5 pb-20 pt-[22px] md:pt-7 lg:flex lg:flex-col">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--dispatch-text-quaternary)]">
          Properties
        </p>

        <EditablePropertyRow
          label="Status"
          open={statusOpen}
          onOpenChange={setStatusOpen}
          popoverContent={statusPopover}
        >
          <div className="flex items-center gap-1.5">
            <StatusCircle
              status={issue.status.toLowerCase()}
              className="size-[13px] shrink-0"
            />
            <span className="text-[13px] text-[var(--dispatch-text-secondary)]">
              {formatStatusLabel(issue.status)}
            </span>
          </div>
        </EditablePropertyRow>

        <EditablePropertyRow
          label="Priority"
          open={priorityOpen}
          onOpenChange={setPriorityOpen}
          popoverContent={priorityPopover}
        >
          <div className="flex items-center gap-1.5">
            <PriorityDots priority={issue.priority} />
            <span className="text-[13px] text-[var(--dispatch-text-secondary)]">
              {PRIORITY_LABELS[issue.priority] ?? 'No priority'}
            </span>
          </div>
        </EditablePropertyRow>

        <PropertyRow label="Assign">
          <span className="text-[13px] text-[var(--dispatch-text-tertiary)]">
            {issue.assignee_id ?? 'Unassigned'}
          </span>
        </PropertyRow>

        <EditablePropertyRow
          label="Labels"
          open={labelsOpen}
          onOpenChange={setLabelsOpen}
          popoverContent={labelsPopover}
        >
          {issue.labels.length > 0 ? (
            issue.labels.map((label) => <LabelPill key={label} label={label} />)
          ) : (
            <span className="text-[13px] text-[var(--dispatch-text-quaternary)]">
              None
            </span>
          )}
        </EditablePropertyRow>

        <PropertyRow label="Project">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] py-[3px] pr-2 pl-[3px] text-xs font-medium text-[var(--dispatch-text-secondary)]">
            <ProjectGlyph
              letter={projectName.charAt(0)}
              projectKey={projectKey}
              color={project?.color}
              small
            />
            <span className="pr-0.5">{projectName}</span>
          </span>
        </PropertyRow>

        <div className="my-3 h-px bg-[var(--dispatch-border-soft)]" />

        <PropertyRow label="Created">
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--dispatch-text-tertiary)]">
            <Calendar size={11} className="shrink-0" />
            {formatDate(issue.created_at)}
          </span>
        </PropertyRow>

        <PropertyRow label="Updated">
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[var(--dispatch-text-tertiary)]">
            <Calendar size={11} className="shrink-0" />
            {formatDate(issue.updated_at)}
          </span>
        </PropertyRow>
      </aside>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function IssuePageSkeleton() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto px-[18px] pb-20 pt-[22px] md:px-10 md:pt-7">
        <div className="mx-auto max-w-[680px]">
          <Skeleton className="mb-5 h-3 w-24 bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="mb-3 h-8 w-full bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="mb-6 h-6 w-2/3 bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="mb-6 h-px w-full bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="mb-3 h-28 w-full bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="h-20 w-full bg-[var(--dispatch-bg-hover)]" />
        </div>
      </div>
      <aside className="hidden w-[240px] shrink-0 border-l border-[var(--dispatch-border-soft)] px-5 pb-20 pt-[22px] md:pt-7 lg:flex lg:flex-col">
        <Skeleton className="mb-4 h-3 w-16 bg-[var(--dispatch-bg-hover)]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-h-[32px] items-center gap-3 py-1">
            <Skeleton className="h-3 w-[72px] bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-4 w-20 bg-[var(--dispatch-bg-hover)]" />
          </div>
        ))}
      </aside>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

export function IssuePageError({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center text-[13px] text-[var(--dispatch-text-tertiary)]">
        <AlertCircle
          size={22}
          className="text-[var(--dispatch-text-quaternary)]"
        />
        <p className="m-0">{message}</p>
      </div>
    </div>
  )
}
