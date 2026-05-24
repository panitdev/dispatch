import { createFileRoute } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import { NowPage } from '../components/dispatch/now-page'

export const Route = createFileRoute('/')({ component: NowRoute })

function NowRoute() {
  return (
    <DispatchLayout active="Now">
      <NowPage />
    </DispatchLayout>
  )
}
