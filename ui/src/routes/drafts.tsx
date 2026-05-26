import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { DraftsPage, DraftsPageSkeleton } from '../components/dispatch/drafts-page'
import { RouteErrorState } from '../components/dispatch/route-error-state'
import { getDraftsPageData } from '../lib/server-data'
import { pageCopy } from '../data/dispatch'

export const Route = createFileRoute('/drafts')({
  loader: () => ({ dataPromise: getDraftsPageData() }),
  component: DraftsRoute,
  errorComponent: DraftsRouteError,
})

function DraftsRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <Await promise={dataPromise} fallback={<DraftsPageSkeleton />}>
      {(data) => <DraftsPage data={data} />}
    </Await>
  )
}

function DraftsRouteError({ error }: ErrorComponentProps) {
  return (
    <RouteErrorState
      title={pageCopy.Drafts.title}
      subtitle={pageCopy.Drafts.subtitle}
      error={error}
    />
  )
}
