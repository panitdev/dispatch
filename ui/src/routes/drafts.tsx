import { createFileRoute } from '@tanstack/react-router'

import { DraftsPage } from '../components/dispatch/drafts-page'

export const Route = createFileRoute('/drafts')({ component: DraftsRoute })

function DraftsRoute() {
  return <DraftsPage />
}
