import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { ProjectChip, StatusPill } from './primitives'

import type { Issue, Section } from '../../data/dispatch'

export function IssueSection({ section }: { section: Section }) {
  return (
    <section className="mb-[18px] overflow-hidden rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] shadow-[var(--dispatch-shadow-card)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--dispatch-border-soft)] bg-[linear-gradient(180deg,oklch(0.21_0.05_264)_0%,var(--dispatch-bg-surface)_100%)] px-[18px] py-[13px]">
        <div className={sectionIconClass(section.tone)}>{section.icon}</div>
        <div className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.005em] text-[var(--dispatch-text-primary)]">
          {section.title}
        </div>
        <div className="ml-auto rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] px-2 py-px text-xs font-semibold text-[var(--dispatch-text-tertiary)]">
          {section.issues.length}
        </div>
      </div>

      {section.issues.map((issue) => (
        <IssueRow key={`${section.title}-${issue.title}`} issue={issue} />
      ))}
    </section>
  )
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <div
      className={`group relative grid cursor-pointer grid-cols-[16px_minmax(0,1fr)_28px] items-center gap-3 border-t border-[var(--dispatch-border-soft)] px-4 py-3 transition-colors first:border-t-0 hover:bg-[var(--dispatch-bg-hover)] md:grid-cols-[16px_minmax(0,1fr)_auto_auto_28px] ${issue.active ? 'bg-[linear-gradient(90deg,var(--dispatch-cobalt-12)_0%,oklch(0.68_0.2_264_/_0.04)_100%)] before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-r-sm before:bg-[var(--dispatch-cobalt-bright)]' : ''}`}
    >
      <div className={dotClass(issue.dot)} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-[-0.005em] text-[var(--dispatch-text-primary)]">
          {issue.title}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-[var(--dispatch-text-tertiary)]">
          {issue.sub}
        </div>
      </div>
      <span className="hidden md:inline-flex">
        <ProjectChip issue={issue} />
      </span>
      <span className="hidden md:inline-flex">
        <StatusPill status={issue.status} />
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        <MoreHorizontal size={16} />
      </Button>
    </div>
  )
}

function sectionIconClass(tone: Section['tone']) {
  const base =
    'grid h-[26px] w-[26px] place-items-center rounded-[var(--dispatch-r-sm)]'
  if (tone === 'amber')
    return `${base} bg-[var(--dispatch-amber-12)] text-[var(--dispatch-amber)]`
  if (tone === 'muted')
    return `${base} bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-secondary)]`
  return `${base} bg-[var(--dispatch-cobalt-12)] text-[var(--dispatch-cobalt-bright)]`
}

function dotClass(dot: Issue['dot']) {
  const base = 'mx-auto h-2.5 w-2.5 rounded-full border-[1.5px]'
  if (dot === 'cobalt') {
    return `${base} border-[var(--dispatch-cobalt-bright)] bg-[var(--dispatch-cobalt-bright)] shadow-[0_0_0_3px_var(--dispatch-cobalt-12)]`
  }
  if (dot === 'amber') {
    return `${base} border-[var(--dispatch-amber)] bg-[var(--dispatch-amber)] shadow-[0_0_0_3px_var(--dispatch-amber-12)]`
  }
  return `${base} border-[var(--dispatch-text-quaternary)] bg-transparent`
}
