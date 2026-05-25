import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import {
  ProjectPage,
  ProjectPageSkeleton,
} from '../components/dispatch/project-page'
import { RouteErrorState } from '../components/dispatch/route-error-state'
import { getProjectPageData } from '../lib/server-data'

export const Route = createFileRoute('/projects_/$projectId')({
  loader: ({ params }) => ({
    dataPromise: getProjectPageData({ data: { projectId: params.projectId } }),
  }),
  component: ProjectPageRoute,
  errorComponent: ProjectPageRouteError,
})

function ProjectPageRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <Await promise={dataPromise} fallback={<ProjectPageSkeleton />}>
      {(data) => <ProjectPage data={data} />}
    </Await>
  )
}

function ProjectPageRouteError({ error }: ErrorComponentProps) {
  return (
    <RouteErrorState
      title="Project"
      subtitle="Could not load this project."
      error={error}
    />
  )
}
