import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MoreHorizontal, User } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/responsive-dialog'

import { IssueContextMenuItems, IssueDropdownMenuItems } from './issue-context-menu'
import { StatusCircle } from './primitives'
import { useIssueSelection } from './issue-selection-context'
import { deleteIssue, getDisplayErrorMessage, updateIssue } from '@/lib/api'
import { exportIssueMarkdown } from '@/lib/issue-markdown-export'

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  if (date.getFullYear() === now.getFullYear()) return `${months[date.getMonth()]} ${date.getDate()}`
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

// ─── Label pill ───────────────────────────────────────────────────────────────

function labelColorStyle(label: string): React.CSSProperties {
  const hash = label.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0)
  const palettes: React.CSSProperties[] = [
    { background: 'var(--dispatch-cobalt-12)', borderColor: 'var(--dispatch-cobalt-30)', color: 'var(--dispatch-cobalt-bright)' },
    { background: 'var(--dispatch-green-12)', borderColor: 'var(--dispatch-green-30)', color: 'var(--dispatch-green-text)' },
    { background: 'var(--dispatch-amber-12)', borderColor: 'var(--dispatch-amber-30)', color: 'var(--dispatch-amber)' },
    { background: 'var(--dispatch-rust-12)', borderColor: 'var(--dispatch-rust-30)', color: 'var(--dispatch-rust)' },
    { background: 'var(--dispatch-bg-elevated)', borderColor: 'var(--dispatch-border)', color: 'var(--dispatch-text-secondary)' },
  ]
  return palettes[hash % palettes.length]
}

function LabelPill({ label }: { label: string }) {
  const style = labelColorStyle(label)
  return (
    <span
      className="inline-flex items-center rounded-[4px] border px-[6px] py-[2px] text-[11px] font-medium leading-[1.4] whitespace-nowrap"
      style={style}
    >
      {label}
    </span>
  )
}

// ─── Priority icon (3-bar chart) ──────────────────────────────────────────────

function PriorityIcon({ priority }: { priority?: number }) {
  const heights =
    priority === 1 ? [10, 10, 10]
    : priority === 2 ? [10, 7, 3]
    : priority === 3 ? [6, 6, 3]
    : priority === 4 ? [3, 3, 3]
    : [3, 6, 10]

  const hasPriority = priority != null && priority > 0
  const color = priority === 1
    ? 'var(--dispatch-rust)'
    : hasPriority
      ? 'var(--dispatch-text-secondary)'
      : 'var(--dispatch-text-quaternary)'

  return (
    <svg width="12" height="10" viewBox="0 0 12 10" className="shrink-0" aria-hidden="true">
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

// ─── Compact issue row ────────────────────────────────────────────────────────

export type CompactIssueRowData = {
  id?: string
  issueKey: string
  status: string
  priority?: number
  title: string
  labels?: string[]
  date?: string
  selected?: boolean
  onSelect?: () => void
}

export function CompactIssueRow({
  id,
  issueKey,
  status,
  priority,
  title,
  labels = [],
  date,
  selected,
  onSelect,
}: CompactIssueRowData) {
  const navigate = useNavigate()
  const { selectedIssueId, closeIssue } = useIssueSelection()
  const [currentStatus, setCurrentStatus] = useState(status.toLowerCase())
  const [currentPriority, setCurrentPriority] = useState(priority ?? 0)
  const [currentLabels, setCurrentLabels] = useState<string[]>(labels)
  const [currentTitle, setCurrentTitle] = useState(title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  const handleOpenChange = (open: boolean) => {
    if (open) setContentKey((k) => k + 1)
    setMenuOpen(open)
  }

  async function handleStatusChange(newStatus: string) {
    const prev = currentStatus
    setCurrentStatus(newStatus)
    if (id) {
      try {
        await updateIssue(id, { status: newStatus })
      } catch (e) {
        setCurrentStatus(prev)
        toast.error(getDisplayErrorMessage(e, 'Failed to update status'))
      }
    }
  }

  async function handlePriorityChange(newPriority: number) {
    const prev = currentPriority
    setCurrentPriority(newPriority)
    if (id) {
      try {
        await updateIssue(id, { priority: newPriority })
      } catch (e) {
        setCurrentPriority(prev)
        toast.error(getDisplayErrorMessage(e, 'Failed to update priority'))
      }
    }
  }

  async function handleLabelsChange(newLabels: string[]) {
    const prev = currentLabels
    setCurrentLabels(newLabels)
    if (id) {
      try {
        await updateIssue(id, { labels: newLabels })
      } catch (e) {
        setCurrentLabels(prev)
        toast.error(getDisplayErrorMessage(e, 'Failed to update labels'))
      }
    }
  }

  async function handleExportMarkdown() {
    if (!id) return

    try {
      await exportIssueMarkdown(id, currentTitle)
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, 'Failed to export issue'))
    }
  }

  const menuProps = {
    status: currentStatus,
    priority: currentPriority,
    labels: currentLabels,
    onStatusChange: handleStatusChange,
    onPriorityChange: handlePriorityChange,
    onLabelsChange: handleLabelsChange,
    onRename: () => queueMicrotask(() => setRenameOpen(true)),
    onDelete: () => queueMicrotask(() => setDeleteOpen(true)),
    onOpen: id
      ? () => navigate({ to: '/issues/$issueId', params: { issueId: id } })
      : undefined,
    onExportMarkdown: id ? () => void handleExportMarkdown() : undefined,
  }

  if (isDeleted) return null

  return (
    <>
      <ContextMenu
        open={menuOpen}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        <ContextMenuTrigger asChild>
          <div
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-pressed={onSelect ? selected : undefined}
            onClick={onSelect}
            onKeyDown={(event) => {
              if (!onSelect || (event.key !== 'Enter' && event.key !== ' ')) {
                return
              }
              event.preventDefault()
              onSelect()
            }}
            className={`group flex cursor-pointer items-center gap-2 px-6 py-[7px] transition-colors hover:bg-[var(--dispatch-bg-hover)] ${selected ? 'bg-[linear-gradient(90deg,var(--dispatch-cobalt-12)_0%,transparent_100%)]' : ''}`}
          >
            {/* Priority */}
            <PriorityIcon priority={currentPriority} />

            {/* Issue key */}
            <span className="w-[72px] shrink-0 truncate font-mono text-[11px] tracking-[0.02em] text-[var(--dispatch-text-quaternary)]">
              {issueKey}
            </span>

            {/* Status circle */}
            <StatusCircle status={currentStatus} />

            {/* Title */}
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.005em] text-[var(--dispatch-text-primary)]">
              {currentTitle}
            </span>

            {/* Labels */}
            {currentLabels.length > 0 && (
              <div className="hidden shrink-0 items-center gap-1 md:flex">
                {currentLabels.slice(0, 3).map((label) => (
                  <LabelPill key={label} label={label} />
                ))}
                {currentLabels.length > 3 && (
                  <span className="text-[11px] text-[var(--dispatch-text-quaternary)]">
                    +{currentLabels.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Assignee placeholder */}
            <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--dispatch-border)] opacity-50">
              <User size={9} className="text-[var(--dispatch-text-quaternary)]" />
            </div>

            {/* Date */}
            {date ? (
              <span className="w-[42px] shrink-0 text-right text-[11.5px] tabular-nums text-[var(--dispatch-text-tertiary)]">
                {formatDate(date)}
              </span>
            ) : (
              <span className="w-[42px] shrink-0" />
            )}

            {/* Action */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 text-[var(--dispatch-text-tertiary)] transition-opacity group-hover:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-[220px]">
                <IssueDropdownMenuItems {...menuProps} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent key={contentKey} className="min-w-[220px]">
          <IssueContextMenuItems {...menuProps} />
        </ContextMenuContent>
      </ContextMenu>

      <IssueRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        issueId={id}
        currentTitle={currentTitle}
        onRenamed={(newTitle) => setCurrentTitle(newTitle)}
      />
      <IssueDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        issueId={id}
        onDeleted={() => {
          setIsDeleted(true)
          if (id && id === selectedIssueId) closeIssue()
        }}
      />
    </>
  )
}

// ─── Rename dialog ────────────────────────────────────────────────────────────

function IssueRenameDialog({
  open,
  onOpenChange,
  issueId,
  currentTitle,
  onRenamed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issueId?: string
  currentTitle: string
  onRenamed: (newTitle: string) => void
}) {
  const [value, setValue] = useState(currentTitle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync value when dialog opens
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(currentTitle)
      setError(null)
      setTimeout(() => inputRef.current?.select(), 50)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || !issueId) return
    setSaving(true)
    setError(null)
    try {
      await updateIssue(issueId, { title: trimmed })
      onRenamed(trimmed)
      onOpenChange(false)
      toast.success('Issue renamed')
    } catch (err) {
      setError(getDisplayErrorMessage(err, 'Failed to rename issue.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dispatch-theme gap-4 bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] border-[var(--dispatch-border-strong)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--dispatch-text-primary)]">Rename issue</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
              {error}
            </p>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)] px-3 py-2 text-[13px] text-[var(--dispatch-text-primary)] placeholder:text-[var(--dispatch-text-quaternary)] outline-none focus:border-[var(--dispatch-cobalt)]"
            placeholder="Issue title"
            required
          />
          <DialogFooter showCloseButton>
            <Button
              type="submit"
              size="sm"
              disabled={!value.trim() || saving}
              loading={saving}
              loadingText="Saving…"
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function IssueDeleteDialog({
  open,
  onOpenChange,
  issueId,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issueId?: string
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!issueId) return
    setDeleting(true)
    setError(null)
    try {
      await deleteIssue(issueId)
      onDeleted()
      onOpenChange(false)
      toast.success('Issue deleted')
    } catch (err) {
      setError(getDisplayErrorMessage(err, 'Failed to delete issue.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dispatch-theme gap-4 bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] border-[var(--dispatch-border-strong)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--dispatch-text-primary)]">Delete issue</DialogTitle>
          <DialogDescription className="text-[var(--dispatch-text-tertiary)]">
            This action cannot be undone. The issue will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
            {error}
          </p>
        )}
        <DialogFooter showCloseButton>
          <Button
            size="sm"
            variant="destructive"
            disabled={deleting}
            loading={deleting}
            loadingText="Deleting…"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
