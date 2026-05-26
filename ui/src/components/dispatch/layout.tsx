import { useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { AuthGuardDialog } from './AuthGuardDialog'
import { CommandPalette } from './command-palette'
import { DetailRail } from './detail-rail'
import {
  IssueSelectionProvider,
  useIssueSelection,
} from './issue-selection-context'
import { IssueCreateDialog } from './IssueCreateDialog'
import { ProjectCreateDialog } from './ProjectCreateDialog'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { PANIT_DEFAULT_EASE } from '@/lib/motion'

import type React from 'react'
import type { DispatchPage } from '../../data/dispatch'

export function DispatchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <IssueSelectionProvider>
      <DispatchLayoutContent>{children}</DispatchLayoutContent>
    </IssueSelectionProvider>
  )
}

function DispatchLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const [commandOpen, setCommandOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const { selectedIssueId } = useIssueSelection()
  const active = useRouterState({
    select: (state) => getActivePage(state.location.pathname),
  })
  const showDetailRail = active !== 'Settings' && selectedIssueId !== null

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
    <div className="dispatch-theme flex h-screen w-screen overflow-hidden bg-[var(--dispatch-bg-base)] font-sans text-sm leading-normal text-[var(--dispatch-text-primary)]">
      <AuthGuardDialog />
      <Sidebar active={active} />
      <section className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[var(--dispatch-bg-base)]">
        <TopBar
          onOpenCommand={() => setCommandOpen(true)}
          onCreateIssue={() => setCreateOpen(true)}
          onCreateProject={() => setCreateProjectOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-[18px] pt-[22px] pb-20 md:px-10 md:pt-7">
          {children}
        </main>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onCreateIssue={() => setCreateOpen(true)}
        />
        <IssueCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
        <ProjectCreateDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
      </section>
      <AnimatePresence>
        {showDetailRail && (
          <motion.div
            key="detail-rail"
            className="hidden shrink-0 overflow-hidden lg:block"
            initial={{ width: 0 }}
            animate={{ width: 380 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.65, ease: PANIT_DEFAULT_EASE }}
          >
            <DetailRail />
          </motion.div>
        )}
      </AnimatePresence>
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
