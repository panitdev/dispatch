import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { Issue, ProjectKey, Status } from '../../data/dispatch'
import type React from 'react'

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-px rounded-[4px] border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] px-1.5 py-0.5 font-sans text-[11px] font-semibold leading-none text-[var(--dispatch-text-tertiary)]">
      {children}
    </span>
  )
}

export function ProjectGlyph({
  letter,
  projectKey,
  small,
}: {
  letter: string
  projectKey: ProjectKey
  small?: boolean
}) {
  const colors = {
    s: 'bg-[linear-gradient(135deg,var(--dispatch-cobalt),oklch(0.5_0.22_264))] text-white shadow-[0_0_0_1px_oklch(0.74_0.18_264_/_0.4)_inset]',
    r: 'bg-[linear-gradient(135deg,var(--dispatch-green),oklch(0.55_0.16_155))] text-[oklch(0.18_0.05_155)] shadow-[0_0_0_1px_oklch(0.85_0.16_155_/_0.4)_inset]',
    v: 'bg-[linear-gradient(135deg,var(--dispatch-rust),oklch(0.5_0.16_45))] text-white shadow-[0_0_0_1px_oklch(0.78_0.16_45_/_0.4)_inset]',
  }

  return (
    <span
      className={`grid place-items-center rounded-[6px] font-sans font-bold tracking-[-0.02em] ${small ? 'h-[18px] w-[18px] rounded-[5px] text-[10px]' : 'h-[22px] w-[22px] text-[11px]'} ${colors[projectKey]}`}
    >
      {letter}
    </span>
  )
}

export function ProjectChip({
  issue,
}: {
  issue: Pick<Issue, 'project' | 'projectKey'>
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] py-[3px] pr-2 pl-[3px] text-xs font-medium text-[var(--dispatch-text-secondary)]">
      <ProjectGlyph
        letter={issue.project.charAt(0)}
        projectKey={issue.projectKey}
        small
      />
      <span className="pr-0.5">{issue.project}</span>
    </span>
  )
}

export function StatusPill({ status }: { status: Status }) {
  const statusClass =
    status === 'Doing'
      ? 'bg-[var(--dispatch-green-12)] text-[var(--dispatch-green-text)] shadow-[0_0_0_1px_var(--dispatch-green-30)_inset]'
      : status === 'Done'
        ? 'bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-tertiary)] shadow-[0_0_0_1px_var(--dispatch-border)_inset]'
        : status === 'Draft'
          ? 'bg-[var(--dispatch-amber-12)] text-[var(--dispatch-amber)] shadow-[0_0_0_1px_var(--dispatch-amber-30)_inset]'
          : 'bg-[var(--dispatch-cobalt-12)] text-[var(--dispatch-cobalt-bright)] shadow-[0_0_0_1px_var(--dispatch-cobalt-30)_inset]'

  return (
    <span
      className={`inline-flex min-w-[50px] items-center justify-center rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.4] tracking-[0.005em] ${statusClass}`}
    >
      {status}
    </span>
  )
}

export function LinkChip({ label }: { label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      fullWidth
      className="justify-between border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-cobalt-bright)] hover:border-[var(--dispatch-cobalt-30)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-cobalt-bright)]"
    >
      <span className="flex-1 text-left">{label}</span>
      <ExternalLink
        size={13}
        className="text-[var(--dispatch-text-tertiary)]"
      />
    </Button>
  )
}
