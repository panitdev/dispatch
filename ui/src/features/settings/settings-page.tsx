import { Calendar, Folder, GitCommit } from 'lucide-react'
import * as React from 'react'

import { AnimatedField } from '../../components/ui/animated-field'
import { pageCopy } from '../../data/dispatch'
import { PageHead } from '../../components/dispatch/page-head'
import type { SettingsPageData } from '../../lib/page-data'

export function SettingsPage({ data }: { data: SettingsPageData }) {
  const [capturePrefix, setCapturePrefix] = React.useState('#Strophe')
  const [reviewWindow, setReviewWindow] = React.useState('Tomorrow 09:30')
  const copy = pageCopy.Settings

  return (
    <>
      <PageHead title={copy.title} subtitle={copy.subtitle} />

      <section className="grid gap-5 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-5 shadow-[var(--dispatch-shadow-card)] md:grid-cols-[minmax(190px,0.55fr)_1fr] md:p-[22px]">
        <div>
          <h2 className="m-0 mb-1.5 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
            Capture defaults
          </h2>
          <p className="m-0 text-[13px] leading-[1.55] text-[var(--dispatch-text-tertiary)]">
            New items inherit these hints until a project or revisit date is
            parsed.
          </p>
        </div>
        <div className="grid gap-3.5 [&_[class*='bg-card']]:bg-[var(--dispatch-bg-elevated)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]">
          <AnimatedField
            id="capture-prefix"
            label="Default project"
            value={capturePrefix}
            onChange={setCapturePrefix}
            placeholder="#Project"
            icon={<Folder size={16} />}
          />
          <AnimatedField
            id="review-window"
            label="Default revisit"
            value={reviewWindow}
            onChange={setReviewWindow}
            placeholder="Tomorrow 09:30"
            icon={<Calendar size={16} />}
          />
        </div>
      </section>

      <section className="grid gap-5 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-5 shadow-[var(--dispatch-shadow-card)] md:grid-cols-[minmax(190px,0.55fr)_1fr] md:p-[22px]">
        <div>
          <h2 className="m-0 mb-1.5 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
            Build info
          </h2>
          <p className="m-0 text-[13px] leading-[1.55] text-[var(--dispatch-text-tertiary)]">
            Version and commit hashes for each deployed artifact.
          </p>
        </div>
        <div className="grid gap-3">
          <BuildHashRow label="API version" value={data.health.version} />
          <BuildHashRow label="API commit" value={data.health.commit_hash} />
          <BuildHashRow label="UI commit" value={data.uiCommitHash} />
        </div>
      </section>
    </>
  )
}

function BuildHashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <GitCommit
        size={14}
        className="shrink-0 text-[var(--dispatch-text-tertiary)]"
      />
      <span className="min-w-[96px] text-[13px] text-[var(--dispatch-text-secondary)]">
        {label}
      </span>
      <code className="rounded bg-[var(--dispatch-bg-elevated)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--dispatch-text-primary)]">
        {value}
      </code>
    </div>
  )
}

export function SettingsPageSkeleton() {
  const copy = pageCopy.Settings
  return (
    <>
      <PageHead title={copy.title} subtitle={copy.subtitle} />
      <section className="h-32 animate-pulse rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)]" />
      <section className="h-32 animate-pulse rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)]" />
    </>
  )
}
