import { FilePenLine, Play, Plus, TimerReset } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { IssueCreateDialog } from '../../components/dispatch/IssueCreateDialog'
import { useIssueSelection } from '../../components/dispatch/issue-selection-context'
import { PageHead } from '../../components/dispatch/page-head'
import { WorkListPage } from '../../components/dispatch/work-list-page'

import { formatStatusLabel, pageCopy } from '../../data/dispatch'

import type { ApiNowIssue, ApiNowResponse } from '@/lib/api'
import type { Issue, Section } from '../../data/dispatch'

export function NowPage({ data }: { data: ApiNowResponse }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { selectedIssueId } = useIssueSelection()

  const sections: Section[] = [
    {
      title: 'Continue',
      icon: <Play size={14} />,
      issues: data.continue.map((issue) =>
        mapNowIssue(issue, issue.id === selectedIssueId),
      ),
    },
    {
      title: 'Next',
      tone: 'amber' as const,
      icon: <TimerReset size={14} />,
      issues: data.next.map((issue) => mapNowIssue(issue)),
    },
    {
      title: 'Drafts',
      tone: 'muted' as const,
      icon: <FilePenLine size={14} />,
      issues: data.drafts.map((issue) => mapNowIssue(issue)),
    },
  ].filter((section) => section.issues.length > 0)

  return (
    <>
      <WorkListPage
        title={pageCopy.Now.title}
        subtitle={pageCopy.Now.subtitle}
        sections={sections}
        action={
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} />
            New issue
          </Button>
        }
      />
      <IssueCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  )
}

export function NowPageSkeleton() {
  return (
    <>
      <PageHead title={pageCopy.Now.title} subtitle={pageCopy.Now.subtitle} />
      <div className="space-y-[18px]">
        {['Continue', 'Next'].map((section) => (
          <section
            key={section}
            className="overflow-hidden rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] shadow-[var(--dispatch-shadow-card)]"
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--dispatch-border-soft)] px-[18px] py-[13px]">
              <Skeleton className="h-[26px] w-[26px] rounded-[var(--dispatch-r-sm)]" />
              <Skeleton className="h-4 w-24 bg-[var(--dispatch-bg-hover)]" />
              <Skeleton className="ml-auto h-6 w-10 rounded-full bg-[var(--dispatch-bg-hover)]" />
            </div>
            <div className="space-y-0">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[16px_minmax(0,1fr)_28px] items-center gap-3 border-t border-[var(--dispatch-border-soft)] px-4 py-3 first:border-t-0 md:grid-cols-[16px_minmax(0,1fr)_auto_auto_28px]"
                >
                  <Skeleton className="mx-auto h-2.5 w-2.5 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/5 bg-[var(--dispatch-bg-hover)]" />
                    <Skeleton className="h-3 w-4/5 bg-[var(--dispatch-bg-hover)]" />
                  </div>
                  <Skeleton className="hidden h-6 w-20 rounded-full bg-[var(--dispatch-bg-hover)] md:block" />
                  <Skeleton className="hidden h-6 w-16 rounded-full bg-[var(--dispatch-bg-hover)] md:block" />
                  <Skeleton className="h-7 w-7 bg-[var(--dispatch-bg-hover)]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function mapNowIssue(issue: ApiNowIssue, active = false): Issue {
  return {
    id: issue.id,
    key: issue.key,
    projectId: issue.project.id,
    title: issue.title,
    sub:
      issue.description ??
      (issue.labels.length > 0
        ? issue.labels.map((label) => `#${label}`).join(' ')
        : `Assigned in ${issue.project.name}`),
    project: issue.project.name,
    projectKey: issue.project.key,
    projectColor: issue.project.color,
    status: formatStatusLabel(issue.status),
    labels: issue.labels,
    active,
    dot: issue.status === 'doing' ? 'cobalt' : issue.status === 'draft' ? 'amber' : 'empty',
  }
}
