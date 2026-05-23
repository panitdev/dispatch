import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { PageHead } from './page-head'
import { ProjectGlyph, StatusPill } from './primitives'
import { pageCopy } from '../../data/dispatch'

const projects = [
  {
    key: 's' as const,
    letter: 'S',
    name: 'Strophe',
    count: 4,
    subtitle: 'Deployment state, reconnect behavior, and onboarding flow.',
  },
  {
    key: 'r' as const,
    letter: 'R',
    name: 'Registry',
    count: 3,
    subtitle: 'Storage cleanup, image masks, and nightly maintenance.',
  },
  {
    key: 'v' as const,
    letter: 'V',
    name: 'Vault',
    count: 5,
    subtitle: 'OAuth, secrets import, and evidence review work.',
  },
]

export function ProjectsPage() {
  return (
    <>
      <PageHead
        title={pageCopy.Projects.title}
        subtitle={pageCopy.Projects.subtitle}
      />
      <div className="grid gap-3.5 md:grid-cols-3">
        {projects.map((project) => (
          <section
            className="flex min-h-[190px] flex-col gap-4 rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] p-[18px] shadow-[var(--dispatch-shadow-card)]"
            key={project.name}
          >
            <div className="flex items-center gap-2.5">
              <ProjectGlyph letter={project.letter} projectKey={project.key} />
              <div>
                <h2 className="m-0 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
                  {project.name}
                </h2>
                <p className="m-0 mt-px text-xs text-[var(--dispatch-text-tertiary)]">
                  {project.count} active issues
                </p>
              </div>
            </div>
            <p className="m-0 text-[13px] leading-[1.55] text-[var(--dispatch-text-tertiary)]">
              {project.subtitle}
            </p>
            <div className="mt-auto flex items-center gap-2.5">
              <StatusPill status={project.key === 's' ? 'Doing' : 'Next'} />
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto"
              >
                <ExternalLink size={14} />
              </Button>
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
