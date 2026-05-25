import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import {
  ProjectsPage,
  ProjectsPageSkeleton,
} from '../components/dispatch/projects-page'
import { RouteErrorState } from '../components/dispatch/route-error-state'
import { pageCopy } from '../data/dispatch'
import { getProjectsPageData } from '../lib/server-data'

export const Route = createFileRoute('/projects')({
  loader: () => ({ dataPromise: getProjectsPageData() }),
  component: ProjectsRoute,
  errorComponent: ProjectsRouteError,
})

function ProjectsRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <DispatchLayout active="Projects">
      <Await promise={dataPromise} fallback={<ProjectsPageSkeleton />}>
        {(data) => <ProjectsPage data={data} />}
      </Await>
    </DispatchLayout>
  )
}

function ProjectsRouteError({ error }: ErrorComponentProps) {
  return (
    <DispatchLayout active="Projects">
      <RouteErrorState
        title={pageCopy.Projects.title}
        subtitle={pageCopy.Projects.subtitle}
        error={error}
      />
    </DispatchLayout>
  )
}
