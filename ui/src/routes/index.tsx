import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { NowPage, NowPageSkeleton } from '../features/now/now-page'
import { RouteErrorState } from '../components/dispatch/route-error-state'
import { getNowPageData } from '../lib/server-data'
import { pageCopy } from '../data/dispatch'

export const Route = createFileRoute('/')({
  loader: () => ({ dataPromise: getNowPageData() }),
  component: NowRoute,
  errorComponent: NowRouteError,
})

function NowRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <Await promise={dataPromise} fallback={<NowPageSkeleton />}>
      {(data) => <NowPage data={data} />}
    </Await>
  )
}

function NowRouteError({ error }: ErrorComponentProps) {
  return (
    <RouteErrorState
      title={pageCopy.Now.title}
      subtitle={pageCopy.Now.subtitle}
      error={error}
    />
  )
}
