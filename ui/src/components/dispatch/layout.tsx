import { CommandPalette } from './command-palette'
import { DetailRail } from './detail-rail'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

import type { DispatchPage } from '../../data/dispatch'
import type React from 'react'

export function DispatchLayout({
  active,
  children,
  commandPalette = false,
}: {
  active: DispatchPage
  children: React.ReactNode
  commandPalette?: boolean
}) {
  return (
    <div className="dispatch-theme grid h-screen w-screen grid-cols-1 overflow-hidden bg-[var(--dispatch-bg-base)] font-sans text-sm leading-normal text-[var(--dispatch-text-primary)] md:grid-cols-[232px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)_380px]">
      <Sidebar active={active} />
      <section className="relative flex min-w-0 flex-col bg-[var(--dispatch-bg-base)]">
        <TopBar />
        <main className="min-w-0 flex-1 overflow-y-auto px-[18px] pt-[22px] pb-20 md:px-10 md:pt-7">
          {children}
        </main>
        {commandPalette && <CommandPalette />}
      </section>
      <DetailRail />
    </div>
  )
}
