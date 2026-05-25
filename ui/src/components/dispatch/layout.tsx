import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { CommandPalette } from './command-palette'
import { DetailRail } from './detail-rail'
import { IssueCreateDialog } from './IssueCreateDialog'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

import type React from 'react'
import type { DispatchPage } from '../../data/dispatch'

export function DispatchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [commandOpen, setCommandOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const active = useRouterState({
    select: (state) => getActivePage(state.location.pathname),
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'n' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setCreateOpen(true)
        return
      }

      if (event.key.toLowerCase() !== 'k' || (!event.ctrlKey && !event.metaKey)) {
        return
      }

      event.preventDefault()
      setCommandOpen((open) => !open)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="dispatch-theme grid h-screen w-screen grid-cols-1 overflow-hidden bg-[var(--dispatch-bg-base)] font-sans text-sm leading-normal text-[var(--dispatch-text-primary)] md:grid-cols-[232px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)_380px]">
      <Sidebar active={active} />
      <section className="relative flex h-screen min-w-0 flex-col overflow-hidden bg-[var(--dispatch-bg-base)]">
        <TopBar onOpenCommand={() => setCommandOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-[18px] pt-[22px] pb-20 md:px-10 md:pt-7">
          {children}
        </main>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onCreateIssue={() => setCreateOpen(true)}
        />
        <IssueCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      </section>
      <DetailRail />
    </div>
  )
}

function getActivePage(pathname: string): DispatchPage {
  if (pathname === '/drafts') {
    return 'Drafts'
  }

  if (pathname === '/settings') {
    return 'Settings'
  }

  if (pathname === '/projects' || pathname.startsWith('/projects/')) {
    return 'Projects'
  }

  return 'Now'
}
