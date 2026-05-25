import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import { NowPage, NowPageSkeleton } from '../components/dispatch/now-page'
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
    <DispatchLayout active="Now">
      <Await promise={dataPromise} fallback={<NowPageSkeleton />}>
        {(data) => <NowPage data={data} />}
      </Await>
    </DispatchLayout>
  )
}

function NowRouteError({ error }: ErrorComponentProps) {
  return (
    <DispatchLayout active="Now">
      <RouteErrorState
        title={pageCopy.Now.title}
        subtitle={pageCopy.Now.subtitle}
        error={error}
      />
    </DispatchLayout>
  )
}
