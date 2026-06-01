import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import {
  ProjectsPage,
  ProjectsPageSkeleton,
} from '../features/projects/projects-page'
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
    <Await promise={dataPromise} fallback={<ProjectsPageSkeleton />}>
      {(data) => <ProjectsPage data={data} />}
    </Await>
  )
}

function ProjectsRouteError({ error }: ErrorComponentProps) {
  return (
    <RouteErrorState
      title={pageCopy.Projects.title}
      subtitle={pageCopy.Projects.subtitle}
      error={error}
    />
  )
}
