import { createFileRoute } from '@tanstack/react-router'

import { InboxPage } from '../components/dispatch/inbox-page'
import { DispatchLayout } from '../components/dispatch/layout'

export const Route = createFileRoute('/inbox')({ component: InboxRoute })

function InboxRoute() {
  return (
    <DispatchLayout active="Inbox">
      <InboxPage />
    </DispatchLayout>
  )
}
