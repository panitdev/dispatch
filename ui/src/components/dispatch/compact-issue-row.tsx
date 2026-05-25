import { MoreHorizontal, User } from 'lucide-react'

import { Button } from '@/components/ui/button'

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
  // bar heights (px out of 10) for [left, center, right]
  // priority: 1=urgent, 2=high, 3=medium, 4=low, 0/undefined=none
  const heights =
    priority === 1 ? [10, 10, 10]  // urgent
    : priority === 2 ? [10, 7, 3]  // high
    : priority === 3 ? [6, 6, 3]   // medium
    : priority === 4 ? [3, 3, 3]   // low
    : [3, 6, 10]                    // no priority — ascending, muted

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

// ─── Status circle icon ───────────────────────────────────────────────────────

function StatusCircle({ status }: { status: string }) {
  const s = status.toLowerCase()

  if (s === 'done') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="7" fill="var(--dispatch-green)" />
        <polyline
          points="4,7 6,9.5 10.5,4.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    )
  }

  if (s === 'doing') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--dispatch-cobalt-bright)" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="3" fill="var(--dispatch-cobalt-bright)" />
      </svg>
    )
  }

  if (s === 'next') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--dispatch-amber)" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="2.5" fill="var(--dispatch-amber)" />
      </svg>
    )
  }

  if (s === 'draft') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle
          cx="7" cy="7" r="6"
          fill="none"
          stroke="var(--dispatch-amber)"
          strokeWidth="1.5"
          strokeDasharray="2.5 1.5"
        />
      </svg>
    )
  }

  if (s === 'backlog') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle
          cx="7" cy="7" r="6"
          fill="none"
          stroke="var(--dispatch-text-quaternary)"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </svg>
    )
  }

  // todo / default
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--dispatch-text-quaternary)" strokeWidth="1.5" />
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
}

export function CompactIssueRow({
  issueKey,
  status,
  priority,
  title,
  labels = [],
  date,
}: CompactIssueRowData) {
  return (
    <div className="group flex items-center gap-2 px-6 py-[7px] cursor-pointer transition-colors hover:bg-[var(--dispatch-bg-hover)]">
      {/* Priority */}
      <PriorityIcon priority={priority} />

      {/* Issue key */}
      <span className="w-[72px] shrink-0 truncate font-mono text-[11px] tracking-[0.02em] text-[var(--dispatch-text-quaternary)]">
        {issueKey}
      </span>

      {/* Status circle */}
      <StatusCircle status={status} />

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.005em] text-[var(--dispatch-text-primary)]">
        {title}
      </span>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          {labels.slice(0, 3).map((label) => (
            <LabelPill key={label} label={label} />
          ))}
          {labels.length > 3 && (
            <span className="text-[11px] text-[var(--dispatch-text-quaternary)]">
              +{labels.length - 3}
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
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 opacity-0 text-[var(--dispatch-text-tertiary)] transition-opacity group-hover:opacity-100"
      >
        <MoreHorizontal size={14} />
      </Button>
    </div>
  )
}
