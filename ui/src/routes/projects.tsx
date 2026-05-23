import { createFileRoute } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import { ProjectsPage } from '../components/dispatch/projects-page'

export const Route = createFileRoute('/projects')({ component: ProjectsRoute })

function ProjectsRoute() {
  return (
    <DispatchLayout active="Projects">
      <ProjectsPage />
    </DispatchLayout>
  )
}
