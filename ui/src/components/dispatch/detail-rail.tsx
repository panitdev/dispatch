import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  Edit3,
  ExternalLink,
  MoreHorizontal,
  Tag,
  User,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from '@/components/ui/button-group'
import { Skeleton } from '@/components/ui/skeleton'
import { getIssue, getProject } from '@/lib/api'

import { useIssueSelection } from './issue-selection-context'
import { ProjectGlyph, StatusPill } from './primitives'
import { formatStatusLabel } from '../../data/dispatch'

import type React from 'react'
import type { ApiIssue, ApiProject } from '@/lib/api'

type DetailState =
  | { status: 'loading'; issue: null; project: null; error: null }
  | { status: 'ready'; issue: ApiIssue; project: ApiProject | null; error: null }
  | { status: 'error'; issue: null; project: null; error: string }

export function DetailRail() {
  const { selectedIssueId, closeIssue } = useIssueSelection()
  const [detail, setDetail] = useState<DetailState>({
    status: 'loading',
    issue: null,
    project: null,
    error: null,
  })

  useEffect(() => {
    if (!selectedIssueId) {
      return
    }

    let cancelled = false
    setDetail({
      status: 'loading',
      issue: null,
      project: null,
      error: null,
    })

    async function loadIssue() {
      try {
        const issue = await getIssue(selectedIssueId!)
        let project: ApiProject | null = null

        try {
          project = await getProject(issue.project_id)
        } catch {
          project = null
        }

        if (!cancelled) {
          setDetail({ status: 'ready', issue, project, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setDetail({
            status: 'error',
            issue: null,
            project: null,
            error:
              error instanceof Error
                ? error.message
                : 'Could not load this issue.',
          })
        }
      }
    }

    void loadIssue()

    return () => {
      cancelled = true
    }
  }, [selectedIssueId])

  return (
    <aside className="hidden min-h-0 flex-col border-l border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] lg:flex">
      <div className="flex items-center border-b border-[var(--dispatch-border-soft)] px-[18px] py-3.5">
        <IconButton label="Open issue">
          <ExternalLink size={15} />
        </IconButton>
        <IconButton label="Close issue" className="ml-auto" onClick={closeIssue}>
          <X size={15} />
        </IconButton>
      </div>

      {detail.status === 'loading' ? <DetailSkeleton /> : null}
      {detail.status === 'error' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-[22px] text-center text-[13px] text-[var(--dispatch-text-tertiary)]">
          <AlertCircle
            size={22}
            className="text-[var(--dispatch-text-quaternary)]"
          />
          <p className="m-0">{detail.error}</p>
        </div>
      ) : null}
      {detail.status === 'ready' ? (
        <IssueDetail issue={detail.issue} project={detail.project} />
      ) : null}
    </aside>
  )
}

function IssueDetail({
  issue,
  project,
}: {
  issue: ApiIssue
  project: ApiProject | null
}) {
  const blocks = issue.blocks.filter(
    (block) => block.content.trim() || block.title?.trim(),
  )

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[22px]">
        <div className="flex items-center gap-2 text-xs text-[var(--dispatch-text-quaternary)]">
          <span className="font-mono font-medium tracking-[0.04em]">
            {issue.key}
          </span>
          <span className="h-3 w-px bg-[var(--dispatch-border-soft)]" />
          <span>{issue.id}</span>
        </div>

        <h2 className="m-0 font-serif text-2xl leading-[1.2] font-medium tracking-[-0.015em] text-[var(--dispatch-text-primary)]">
          {issue.title}
        </h2>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ProjectChip issue={issue} project={project} />
          <StatusPill status={formatStatusLabel(issue.status)} />
          {issue.labels.map((label) => (
            <span
              className="inline-flex items-center rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] px-2.5 py-[3px] text-[11.5px] font-medium text-[var(--dispatch-text-secondary)]"
              key={label}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-[18px] text-xs text-[var(--dispatch-text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} />
            Updated {formatDate(issue.updated_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User size={13} />
            {issue.assignee_id ? `Assignee ${issue.assignee_id}` : 'Unassigned'}
          </span>
        </div>

        <div className="my-0.5 h-px bg-[var(--dispatch-border-soft)]" />

        {blocks.length > 0 ? (
          blocks.map((block) => (
            <DetailSection
              icon={block.kind === 'action' ? <ArrowRight size={15} /> : <BookOpen size={15} />}
              title={block.title ?? formatStatusLabel(block.kind)}
              key={block.id}
            >
              <p className="m-0 whitespace-pre-wrap">{block.content}</p>
            </DetailSection>
          ))
        ) : (
          <DetailSection icon={<BookOpen size={15} />} title="Body">
            <p className="m-0 text-[var(--dispatch-text-tertiary)]">
              No body content yet.
            </p>
          </DetailSection>
        )}
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
    </>
  )
}

function ProjectChip({
  issue,
  project,
}: {
  issue: ApiIssue
  project: ApiProject | null
}) {
  const projectName = project?.name ?? `Project ${issue.project_id}`
  const projectKey = project?.key ?? issue.project_id

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] py-[3px] pr-2 pl-[3px] text-xs font-medium text-[var(--dispatch-text-secondary)]">
      <ProjectGlyph
        letter={projectName.charAt(0)}
        projectKey={projectKey}
        color={project?.color}
        small
      />
      <span className="pr-0.5">{projectName}</span>
    </span>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-[18px] overflow-hidden px-[22px] py-[22px]">
      <Skeleton className="h-4 w-28 bg-[var(--dispatch-bg-hover)]" />
      <Skeleton className="h-16 w-full bg-[var(--dispatch-bg-hover)]" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full bg-[var(--dispatch-bg-hover)]" />
        <Skeleton className="h-6 w-16 rounded-full bg-[var(--dispatch-bg-hover)]" />
      </div>
      <Skeleton className="h-px w-full bg-[var(--dispatch-bg-hover)]" />
      <Skeleton className="h-28 w-full bg-[var(--dispatch-bg-hover)]" />
      <Skeleton className="h-20 w-full bg-[var(--dispatch-bg-hover)]" />
    </div>
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
  onClick,
}: {
  children: React.ReactNode
  label: string
  className?: string
  onClick?: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={className}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

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
