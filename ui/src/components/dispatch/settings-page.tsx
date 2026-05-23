import { Calendar, Folder } from 'lucide-react'
import * as React from 'react'

import { AnimatedField } from '../ui/animated-field'
import { pageCopy } from '../../data/dispatch'
import { PageHead } from './page-head'

export function SettingsPage() {
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
    </>
  )
}
