import { Await, createFileRoute } from '@tanstack/react-router'

import { SettingsPage, SettingsPageSkeleton } from '../features/settings/settings-page'
import { getSettingsPageData } from '../lib/page-data'

export const Route = createFileRoute('/settings')({
  loader: () => ({ dataPromise: getSettingsPageData() }),
  component: SettingsRoute,
})

function SettingsRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <Await promise={dataPromise} fallback={<SettingsPageSkeleton />}>
      {(data) => <SettingsPage data={data} />}
    </Await>
  )
}
