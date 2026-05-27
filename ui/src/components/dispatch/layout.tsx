import { useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { selectedIssueId, closeIssue } = useIssueSelection()
  const { active, pathname } = useRouterState({
    select: (state) => ({
      active: getActivePage(state.location.pathname),
      pathname: state.location.pathname,
    }),
  })
  const showDetailRail =
    active !== 'Settings' && active !== 'Issue' && selectedIssueId !== null

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

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  return (
    <div className="dispatch-theme flex h-screen w-screen overflow-hidden bg-[var(--dispatch-bg-base)] font-sans text-sm leading-normal text-[var(--dispatch-text-primary)]">
      <AuthGuardDialog />

      {/* Desktop sidebar — framer-motion width animation, hidden on mobile */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="sidebar"
            className="hidden h-full shrink-0 overflow-hidden md:block"
            initial={{ width: 0 }}
            animate={{ width: 232 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.65, ease: PANIT_DEFAULT_EASE }}
          >
            <Sidebar active={active} onToggle={() => setSidebarOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sidebar — vaul bottom drawer, hidden on md+ */}
      <DrawerPrimitive.Root
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
        direction="bottom"
        noBodyStyles
        shouldScaleBackground={false}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 md:hidden" />
          <DrawerPrimitive.Content className="dispatch-theme fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col overflow-hidden rounded-t-[18px] outline-none md:hidden">
            <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-[var(--dispatch-border-soft)]" />
            <Sidebar active={active} onToggle={() => setMobileSidebarOpen(false)} />
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>

      <section className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[var(--dispatch-bg-base)]">
        <TopBar
          onOpenCommand={() => setCommandOpen(true)}
          onCreateIssue={() => setCreateOpen(true)}
          onCreateProject={() => setCreateProjectOpen(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className={`min-w-0 flex-1 overflow-x-hidden ${active === 'Issue' ? 'overflow-hidden' : 'overflow-y-auto px-[18px] pt-[22px] pb-20 md:px-10 md:pt-7'}`}>
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

      {/* Desktop detail rail — framer-motion width animation, hidden on mobile/tablet */}
      <AnimatePresence>
        {showDetailRail && (
          <motion.div
            key="detail-rail"
            className="hidden h-full shrink-0 overflow-hidden lg:block"
            initial={{ width: 0 }}
            animate={{ width: 380 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.65, ease: PANIT_DEFAULT_EASE }}
          >
            <DetailRail />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile/tablet detail panel — vaul bottom drawer, hidden on lg+ */}
      <DrawerPrimitive.Root
        open={showDetailRail}
        onOpenChange={(open) => {
          if (!open) closeIssue()
        }}
        direction="bottom"
        modal={false}
        noBodyStyles
        shouldScaleBackground={false}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 pointer-events-none lg:hidden" />
          <DrawerPrimitive.Content
            className="dispatch-theme fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col overflow-hidden rounded-t-[18px] outline-none lg:hidden"
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-[var(--dispatch-border-soft)]" />
            <DetailRail className="w-full flex-1 border-l-0 h-auto" />
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
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

  if (pathname.startsWith('/issues/')) {
    return 'Issue'
  }

  return 'Now'
}
