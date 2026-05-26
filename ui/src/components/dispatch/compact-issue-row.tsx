import { useState } from 'react'
import { MoreHorizontal, User } from 'lucide-react'

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

import { IssueContextMenuItems, IssueDropdownMenuItems } from './issue-context-menu'
import { StatusCircle } from './primitives'

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
  issueKey,
  status,
  priority,
  title,
  labels = [],
  date,
  selected,
  onSelect,
}: CompactIssueRowData) {
  const [currentStatus, setCurrentStatus] = useState(status.toLowerCase())
  const [currentLabels, setCurrentLabels] = useState<string[]>(labels)

  const menuProps = {
    status: currentStatus,
    labels: currentLabels,
    onStatusChange: setCurrentStatus,
    onLabelsChange: setCurrentLabels,
    onRename: () => {},
    onDelete: () => {},
  }

  return (
    <ContextMenu>
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
          <PriorityIcon priority={priority} />

          {/* Issue key */}
          <span className="w-[72px] shrink-0 truncate font-mono text-[11px] tracking-[0.02em] text-[var(--dispatch-text-quaternary)]">
            {issueKey}
          </span>

          {/* Status circle */}
          <StatusCircle status={currentStatus} />

          {/* Title */}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.005em] text-[var(--dispatch-text-primary)]">
            {title}
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

      <ContextMenuContent className="min-w-[220px]">
        <IssueContextMenuItems {...menuProps} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
