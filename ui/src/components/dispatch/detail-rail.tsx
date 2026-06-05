import {
  AlertCircle,
  Calendar,
  Download,
  ExternalLink,
  MoreHorizontal,
  Tag,
  User,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { getDisplayErrorMessage, getIssue, getProject } from '@/lib/api'
import { exportIssueMarkdown } from '@/lib/issue-markdown-export'
import { IssueBodyEditorSection } from '@/components/dispatch/IssueBodyEditorSection'
import { toast } from 'sonner'

import { useIssueSelection } from './issue-selection-context'
import { ProjectGlyph, StatusPill } from './primitives'
import { formatStatusLabel } from '../../data/dispatch'

import { cn } from '@/lib/utils'

import type React from 'react'
import type { ApiIssue, ApiProject } from '@/lib/api'

type DetailState =
  | { status: 'loading'; issue: null; project: null; error: null }
  | {
      status: 'ready'
      issue: ApiIssue
      project: ApiProject | null
      error: null
    }
  | { status: 'error'; issue: null; project: null; error: string }

export function DetailRail({ className }: { className?: string }) {
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
    <aside
      className={cn(
        'flex h-full w-[380px] shrink-0 flex-col border-l border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)]',
        className,
      )}
    >
      <div className="flex items-center border-b border-[var(--dispatch-border-soft)] px-[18px] py-3.5">
        <IconButton label="Open issue">
          <ExternalLink size={15} />
        </IconButton>
        <IconButton
          label="Close issue"
          className="ml-auto"
          onClick={closeIssue}
        >
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
  const [currentIssue, setCurrentIssue] = useState(issue)

  useEffect(() => {
    setCurrentIssue(issue)
  }, [issue.id])

  async function handleExportMarkdown() {
    try {
      await exportIssueMarkdown(currentIssue.id, currentIssue.title)
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, 'Failed to export issue'))
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[22px]">
        <div className="flex items-center gap-2 text-xs text-[var(--dispatch-text-quaternary)]">
          <span className="font-mono font-medium tracking-[0.04em]">
            {currentIssue.key}
          </span>
          <span className="h-3 w-px bg-[var(--dispatch-border-soft)]" />
          <span>{currentIssue.id}</span>
        </div>

        <h2 className="m-0 font-serif text-2xl leading-[1.2] font-medium tracking-[-0.015em] text-[var(--dispatch-text-primary)]">
          {currentIssue.title}
        </h2>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <ProjectChip issue={currentIssue} project={project} />
          <StatusPill status={formatStatusLabel(currentIssue.status)} />
          {currentIssue.labels.map((label) => (
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
            Updated {formatDate(currentIssue.updated_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User size={13} />
            {currentIssue.assignee_id
              ? `Assignee ${currentIssue.assignee_id}`
              : 'Unassigned'}
          </span>
        </div>

        <div className="my-0.5 h-px bg-[var(--dispatch-border-soft)]" />
        <IssueBodyEditorSection
          issue={currentIssue}
          onIssueChange={setCurrentIssue}
        />
      </div>

      <div className="flex items-center gap-1.5 border-t border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-[18px] py-3">
        <IconButton label="Tag">
          <Tag size={15} />
        </IconButton>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="More">
              <MoreHorizontal size={15} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-[200px]">
            <DropdownMenuItem
              onSelect={() => void handleExportMarkdown()}
              className="py-1.5 text-[13px]"
            >
              <Download size={14} className="shrink-0" />
              Export as Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
