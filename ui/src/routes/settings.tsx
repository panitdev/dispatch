import { createFileRoute } from '@tanstack/react-router'

import { DispatchLayout } from '../components/dispatch/layout'
import { SettingsPage } from '../components/dispatch/settings-page'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

function SettingsRoute() {
  return (
    <DispatchLayout active="Settings">
      <SettingsPage />
    </DispatchLayout>
  )
}
