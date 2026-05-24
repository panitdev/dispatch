import { createFileRoute } from '@tanstack/react-router'

import { DraftsPage } from '../components/dispatch/drafts-page'
import { DispatchLayout } from '../components/dispatch/layout'

export const Route = createFileRoute('/drafts')({ component: DraftsRoute })

function DraftsRoute() {
  return (
    <DispatchLayout active="Drafts">
      <DraftsPage />
    </DispatchLayout>
  )
}
