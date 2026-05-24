import { FilePenLine, Play, TimerReset } from 'lucide-react'
import { useEffect, useState } from 'react'

import { WorkListPage } from './work-list-page'
import { getNow } from '@/lib/api'

import { formatStatusLabel, pageCopy } from '../../data/dispatch'

import type { ApiNowIssue } from '@/lib/api'
import type { Issue } from '../../data/dispatch'

export function NowPage() {
  const [sections, setSections] = useState([
    { title: 'Continue', icon: <Play size={14} />, issues: [] as Issue[] },
    {
      title: 'Next',
      tone: 'amber' as const,
      icon: <TimerReset size={14} />,
      issues: [] as Issue[],
    },
    {
      title: 'Drafts',
      tone: 'muted' as const,
      icon: <FilePenLine size={14} />,
      issues: [] as Issue[],
    },
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getNow()

        if (cancelled) {
          return
        }

        setSections([
          {
            title: 'Continue',
            icon: <Play size={14} />,
            issues: data.continue.map((issue, index) =>
              mapNowIssue(issue, index === 0),
            ),
          },
          {
            title: 'Next',
            tone: 'amber',
            icon: <TimerReset size={14} />,
            issues: data.next.map((issue) => mapNowIssue(issue)),
          },
          {
            title: 'Drafts',
            tone: 'muted',
            icon: <FilePenLine size={14} />,
            issues: data.drafts.map((issue) => mapNowIssue(issue)),
          },
        ])
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load now view.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <WorkListPage
        title={pageCopy.Now.title}
        subtitle={pageCopy.Now.subtitle}
        sections={sections}
      />
      {isLoading ? (
        <div className="text-[13px] text-[var(--dispatch-text-tertiary)]">
          Loading current work…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[var(--dispatch-r-lg)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-4 py-3 text-[13px] text-[var(--dispatch-amber)]">
          {error}
        </div>
      ) : null}
    </>
  )
}

function mapNowIssue(issue: ApiNowIssue, active = false): Issue {
  return {
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
    active,
    dot: issue.status === 'doing' ? 'cobalt' : issue.status === 'draft' ? 'amber' : 'empty',
  }
}
