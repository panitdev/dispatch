import type { ReactNode } from 'react'

export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="m-0 mb-1.5 font-serif text-[38px] leading-[1.05] font-medium tracking-[-0.015em] text-[var(--dispatch-text-primary)]">
          {title}
          <span className="text-[var(--dispatch-cobalt-bright)] italic">.</span>
        </h1>
        <p className="m-0 text-[13.5px] text-[var(--dispatch-text-tertiary)]">
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
