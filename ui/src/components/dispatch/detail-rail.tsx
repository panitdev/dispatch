import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  Edit3,
  ExternalLink,
  Link as LinkIcon,
  MoreHorizontal,
  Tag,
  User,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from '@/components/ui/button-group'

import { LinkChip, ProjectChip, StatusPill } from './primitives'
import { continueIssues } from '../../data/dispatch'

import type React from 'react'

export function DetailRail() {
  return (
    <aside className="hidden min-h-0 flex-col border-l border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] lg:flex">
      <div className="flex items-center border-b border-[var(--dispatch-border-soft)] px-[18px] py-3.5">
        <IconButton label="Open">
          <ExternalLink size={15} />
        </IconButton>
        <IconButton label="Close" className="ml-auto">
          <X size={15} />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[22px]">
        <h2 className="m-0 font-serif text-2xl leading-[1.2] font-medium tracking-[-0.015em] text-[var(--dispatch-text-primary)]">
          Deployment retry state model
        </h2>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ProjectChip issue={continueIssues[0]} />
          <StatusPill status="Doing" />
          <span className="inline-flex items-center rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] px-2.5 py-[3px] text-[11.5px] font-medium text-[var(--dispatch-text-secondary)]">
            infra
          </span>
        </div>

        <div className="mt-1 flex gap-[18px] text-xs text-[var(--dispatch-text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} />
            Updated 18m ago
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User size={13} />
            You
          </span>
        </div>

        <div className="my-0.5 h-px bg-[var(--dispatch-border-soft)]" />

        <DetailSection
          icon={<BookOpen size={15} />}
          title="Current understanding"
        >
          <p>
            Need a simpler retry model for reconnect and unresolved deployments.
          </p>
        </DetailSection>
        <DetailSection icon={<ArrowRight size={15} />} title="Next action">
          <p>
            Decide whether deployment records represent attempts or stable
            deployment instances.
          </p>
        </DetailSection>
        <DetailSection icon={<Edit3 size={15} />} title="Notes">
          <ul className="m-0 flex flex-col gap-1.5 pl-[18px] marker:text-[var(--dispatch-text-quaternary)]">
            <li>Current model mixes attempts and final state.</li>
            <li>Reconnect logic is harder to reason about.</li>
            <li>Should improve visibility in agent + UI.</li>
          </ul>
        </DetailSection>
        <DetailSection icon={<LinkIcon size={15} />} title="Links">
          <div className="flex flex-col gap-1.5">
            <LinkChip label="RFC draft" />
            <LinkChip label="agent logs" />
          </div>
        </DetailSection>
      </div>

      <div className="flex items-center gap-1.5 border-t border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-[18px] py-3">
        <IconButton label="Tag">
          <Tag size={15} />
        </IconButton>
        <div className="flex-1" />
        <IconButton label="More">
          <MoreHorizontal size={15} />
        </IconButton>
        <ButtonGroup>
          <Button
            size="xs"
            className="border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]"
          >
            <Edit3 size={13} />
            Edit issue
          </Button>
          <ButtonGroupSeparator className="bg-[var(--dispatch-cta-divider)]" />
          <Button
            size="icon-xs"
            className="border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]"
            aria-label="Edit issue options"
          >
            <ChevronDown size={12} />
          </Button>
        </ButtonGroup>
      </div>
    </aside>
  )
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 text-[13.5px] leading-[1.55] text-[var(--dispatch-text-secondary)]">
      <div className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--dispatch-text-primary)] [&_svg]:text-[var(--dispatch-cobalt-bright)]">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

function IconButton({
  children,
  label,
  className = '',
}: {
  children: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={className}
      title={label}
    >
      {children}
    </Button>
  )
}
