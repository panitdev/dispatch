import { createFileRoute } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import { WaitingPage } from '../components/dispatch/waiting-page'

export const Route = createFileRoute('/waiting')({ component: WaitingRoute })

function WaitingRoute() {
  return (
    <DispatchLayout active="Waiting">
      <WaitingPage />
    </DispatchLayout>
  )
}
