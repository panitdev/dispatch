import { FilePenLine } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

import { PageHead } from '../../components/dispatch/page-head'
import { WorkListPage } from '../../components/dispatch/work-list-page'

import { formatStatusLabel, pageCopy } from '../../data/dispatch'

import type { ApiNowIssue } from '@/lib/api'
import type { Issue } from '../../data/dispatch'

export function DraftsPage({ data }: { data: ApiNowIssue[] }) {
  return (
    <WorkListPage
      title={pageCopy.Drafts.title}
      subtitle={pageCopy.Drafts.subtitle}
      sections={[
        {
          title: 'Drafts',
          tone: 'muted',
          icon: <FilePenLine size={14} />,
          issues: data.map(mapDraftIssue),
        },
      ].filter((section) => section.issues.length > 0)}
    />
  )
}

export function DraftsPageSkeleton() {
  return (
    <>
      <PageHead title={pageCopy.Drafts.title} subtitle={pageCopy.Drafts.subtitle} />
      <div className="space-y-[18px]">
        <section className="overflow-hidden rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] shadow-[var(--dispatch-shadow-card)]">
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
      </div>
    </>
  )
}

function mapDraftIssue(issue: ApiNowIssue): Issue {
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
    dot: 'amber',
  }
}
