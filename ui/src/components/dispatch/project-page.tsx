import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2, SlidersHorizontal, Filter, MoreHorizontal, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CompactIssueRow } from './compact-issue-row'
import { useIssueSelection } from './issue-selection-context'

import type { ApiIssue, ApiProject } from '@/lib/api'
import type { ProjectPageData } from '@/lib/server-data'

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'backlog' | 'drafts'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterIssues(issues: ApiIssue[], filter: FilterTab): ApiIssue[] {
  switch (filter) {
    case 'active':
      return issues.filter((i) => ['doing', 'next'].includes(i.status.toLowerCase()))
    case 'backlog':
      return issues.filter((i) => ['todo', 'backlog'].includes(i.status.toLowerCase()))
    case 'drafts':
      return issues.filter((i) => i.status.toLowerCase() === 'draft')
    default:
      return issues
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  if (date.getFullYear() === now.getFullYear()) {
    return `${months[date.getMonth()]} ${date.getDate()}`
  }
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const PAGE_SIZE = 25

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectPage({ data }: { data: ProjectPageData }) {
  const { project, issues } = data
  const { selectedIssueId, selectIssue } = useIssueSelection()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filterCounts: Record<FilterTab, number> = {
    all: issues.length,
    active: filterIssues(issues, 'active').length,
    backlog: filterIssues(issues, 'backlog').length,
    drafts: filterIssues(issues, 'drafts').length,
  }

  const filteredIssues = filterIssues(issues, activeFilter)
  const visibleIssues = filteredIssues.slice(0, visibleCount)
  const hasMore = visibleCount < filteredIssues.length

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [activeFilter])

  // Stable refs so the IntersectionObserver callback never needs to be recreated
  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore
  const filteredLengthRef = useRef(filteredIssues.length)
  filteredLengthRef.current = filteredIssues.length

  // Infinite scroll via IntersectionObserver
  const handleSentinel = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasMoreRef.current) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredLengthRef.current))
      }
    },
    [],
  )

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(handleSentinel, { threshold: 0.1 })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [handleSentinel])

  return (
    <div className="-mx-[18px] md:-mx-10 -mt-[22px] md:-mt-7">
      {/* ── Project header (scrolls away) ────────────────────────────────── */}
      <div className="flex items-start justify-between px-[18px] md:px-10 pt-[22px] md:pt-7 pb-5">
        <div className="flex items-start gap-4">
          <ProjectHeaderGlyph project={project} />
          <div className="pt-0.5">
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-[var(--dispatch-text-primary)]">
                {project.name}
              </h1>
              <button
                type="button"
                className="text-[var(--dispatch-text-quaternary)] hover:text-[var(--dispatch-amber)] transition-colors"
                aria-label="Star project"
              >
                <Star size={15} />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-[var(--dispatch-text-tertiary)]">
              <span className="font-mono text-[11.5px] font-medium tracking-[0.04em] text-[var(--dispatch-text-quaternary)] uppercase">
                {project.key}
              </span>
              <span className="h-3 w-px bg-[var(--dispatch-border-soft)]" />
              <span>Updated {formatDate(project.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-secondary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] hover:text-[var(--dispatch-text-primary)]"
          >
            <Share2 size={13} />
            Share
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>
      </div>

      {/* ── Issues / Settings tabs (scrolls away) ────────────────────────── */}
      <div className="flex items-end gap-0 border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10">
        <TabItem active>Issues</TabItem>
        <TabItem>Settings</TabItem>
      </div>

      {/* ── Sticky filter bar (always visible) ───────────────────────────── */}
      <div className="sticky -top-[22px] z-10 flex items-center gap-1.5 border-b border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-base)] px-[18px] py-2.5 md:-top-7 md:px-10">
        <FilterTabItem
          active={activeFilter === 'all'}
          count={filterCounts.all}
          onClick={() => setActiveFilter('all')}
        >
          All issues
        </FilterTabItem>
        <FilterTabItem
          active={activeFilter === 'active'}
          count={filterCounts.active}
          onClick={() => setActiveFilter('active')}
        >
          Active
        </FilterTabItem>
        <FilterTabItem
          active={activeFilter === 'backlog'}
          count={filterCounts.backlog}
          onClick={() => setActiveFilter('backlog')}
        >
          Backlog
        </FilterTabItem>
        <FilterTabItem
          active={activeFilter === 'drafts'}
          count={filterCounts.drafts}
          onClick={() => setActiveFilter('drafts')}
        >
          Drafts
        </FilterTabItem>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
          >
            <Filter size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
          >
            <SlidersHorizontal size={14} />
          </Button>
        </div>
      </div>

      {/* ── Issue list ────────────────────────────────────────────────────── */}
      <div>
        {visibleIssues.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--dispatch-text-tertiary)]">
            No issues in this filter.
          </div>
        ) : (
          <div>
            {visibleIssues.map((issue) => (
              <div
                key={issue.id}
                className="border-b border-[var(--dispatch-border-soft)] last:border-b-0"
              >
                <CompactIssueRow
                  id={issue.id}
                  issueKey={issue.key}
                  status={issue.status}
                  priority={issue.priority}
                  title={issue.title}
                  labels={issue.labels}
                  date={issue.updated_at}
                  selected={issue.id === selectedIssueId}
                  onSelect={() => selectIssue(issue.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Bottom sentinel for infinite scroll */}
        {hasMore ? (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center gap-2 py-6"
          >
            <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)] [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)] [animation-delay:300ms]" />
          </div>
        ) : filteredIssues.length > 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--dispatch-text-quaternary)]">
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectHeaderGlyph({ project }: { project: ApiProject }) {
  const color = project.color
  return (
    <span
      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[12px] text-[22px] font-bold tracking-[-0.02em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_2px_8px_rgba(0,0,0,0.35)]"
      style={{
        background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black))`,
      }}
    >
      {project.key.charAt(0)}
    </span>
  )
}

function TabItem({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={`relative cursor-pointer px-1 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors mr-5 ${active
        ? 'text-[var(--dispatch-text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:bg-[var(--dispatch-cobalt-bright)]'
        : 'text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-secondary)]'
        }`}
    >
      {children}
    </div>
  )
}

function FilterTabItem({
  children,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-[var(--dispatch-r-md)] px-3 py-[5px] text-[13px] font-medium transition-colors ${active
        ? 'bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-primary)] shadow-[0_0_0_1px_var(--dispatch-border-soft)_inset]'
        : 'text-[var(--dispatch-text-tertiary)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-secondary)]'
        }`}
    >
      {children}
      <span
        className={`rounded-full px-[6px] py-px text-[11px] font-semibold leading-[1.4] tabular-nums ${active
          ? 'bg-[var(--dispatch-cobalt-12)] text-[var(--dispatch-cobalt-bright)]'
          : 'bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-quaternary)]'
          }`}
      >
        {count}
      </span>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ProjectPageSkeleton() {
  return (
    <div className="-mx-[18px] md:-mx-10 -mt-[22px] md:-mt-7">
      <div className="flex items-start gap-4 px-[18px] md:px-10 pt-[22px] md:pt-7 pb-5">
        <Skeleton className="h-[52px] w-[52px] rounded-[12px] bg-[var(--dispatch-bg-hover)]" />
        <div className="space-y-2 pt-0.5">
          <Skeleton className="h-6 w-40 bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="h-4 w-28 bg-[var(--dispatch-bg-hover)]" />
        </div>
      </div>
      <div className="border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10 pb-px">
        <div className="flex gap-5">
          <Skeleton className="h-5 w-14 bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="h-5 w-16 bg-[var(--dispatch-bg-hover)]" />
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10 py-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-[var(--dispatch-r-md)] bg-[var(--dispatch-bg-hover)]" />
        ))}
      </div>
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--dispatch-border-soft)] py-3">
            <Skeleton className="h-3.5 w-3.5 rounded-[3px] bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 w-16 bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 flex-1 bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-5 w-16 rounded-[4px] bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 w-20 bg-[var(--dispatch-bg-hover)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
