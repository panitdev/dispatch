import { ArrowDown } from 'lucide-react'

import { IssueSection } from './issue-section'
import { Kbd } from './primitives'
import { PageHead } from './page-head'

import type { Section } from '../../data/dispatch'

export function WorkListPage({
  title,
  subtitle,
  sections,
}: {
  title: string
  subtitle: string
  sections: Section[]
}) {
  return (
    <>
      <PageHead title={title} subtitle={subtitle} />

      {sections.map((section) => (
        <IssueSection key={section.title} section={section} />
      ))}

      <div className="mt-3.5 flex items-center gap-2 text-xs text-[var(--dispatch-text-tertiary)]">
        <ArrowDown
          size={14}
          className="text-[var(--dispatch-text-quaternary)]"
        />
        <span>Press</span>
        <Kbd>J</Kbd>
        <Kbd>K</Kbd>
        <span>to navigate</span>
      </div>
    </>
  )
}
