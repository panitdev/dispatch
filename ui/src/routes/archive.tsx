import { createFileRoute } from '@tanstack/react-router'

import { ArchivePage } from '../components/dispatch/archive-page'
import { DispatchLayout } from '../components/dispatch/layout'

export const Route = createFileRoute('/archive')({ component: ArchiveRoute })

function ArchiveRoute() {
  return (
    <DispatchLayout active="Archive">
      <ArchivePage />
    </DispatchLayout>
  )
}
