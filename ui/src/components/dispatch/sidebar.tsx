import {
  FilePenLine,
  Folder,
  Home,
  PanelLeft,
  Pin,
  Settings,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { DispatchLogo } from '@/components/ui/logos'

import { ProjectGlyph } from './primitives'

import type { DispatchPage, ProjectKey } from '../../data/dispatch'

export function Sidebar({ active }: { active: DispatchPage }) {
  const nav = [
    { label: 'Now' as const, to: '/', icon: Home },
    { label: 'Projects' as const, to: '/projects', icon: Folder },
    { label: 'Drafts' as const, to: '/drafts', icon: FilePenLine },
  ]

  return (
    <aside className="hidden min-h-0 flex-col border-r border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-2.5 pt-3.5 pb-3 md:flex">
      <div className="mb-2.5 flex items-center gap-2.5 rounded-[var(--dispatch-r-lg)] bg-[linear-gradient(90deg,var(--dispatch-brand-grad-start)_0%,var(--dispatch-brand-grad-mid)_34%,var(--dispatch-brand-grad-end)_100%)] px-2.5 py-2.5">
        <SidebarLogo />
        <div className="text-[17px] font-semibold tracking-[-0.015em]">
          Dispatch
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
        >
          <PanelLeft size={16} />
        </Button>
      </div>

      <nav className="flex flex-col gap-px">
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              className={navItemClass(active === item.label)}
            >
              <Icon size={16} className="shrink-0 opacity-85" />
              <span>{item.label}</span>
              {'count' in item && (
                <span className="ml-auto rounded-full bg-[var(--dispatch-bg-hover)] px-[7px] py-px text-[11px] font-semibold text-[var(--dispatch-text-tertiary)]">
                  {item.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-[var(--dispatch-text-quaternary)] uppercase">
        Pinned
      </div>
      <div className="flex flex-col gap-0.5">
        <PinnedProject letter="S" name="Strophe" projectKey="s" />
        <PinnedProject letter="R" name="Registry" projectKey="r" />
        <PinnedProject letter="V" name="Vault" projectKey="v" />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 border-t border-[var(--dispatch-border-soft)] pt-2">
        <Link
          to="/settings"
          className={`${navItemClass(active === 'Settings')} flex-1`}
        >
          <Settings size={16} className="shrink-0 opacity-85" />
          <span>Settings</span>
        </Link>
        <Button
          variant="ghost"
          size="icon-xs"
        >
          <PanelLeft size={14} />
        </Button>
      </div>
    </aside>
  )
}

function SidebarLogo() {
  return (
    <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[7px]">
      <DispatchLogo size={32} className="size-8" />
    </div>
  )
}

function PinnedProject({
  letter,
  name,
  projectKey,
}: {
  letter: string
  name: string
  projectKey: ProjectKey
}) {
  return (
    <div className="group flex cursor-pointer items-center gap-2.5 rounded-[var(--dispatch-r-md)] px-2.5 py-1.5 transition-colors hover:bg-[var(--dispatch-bg-hover)]">
      <ProjectGlyph letter={letter} projectKey={projectKey} small />
      <span className="text-[13px] font-medium text-[var(--dispatch-text-secondary)]">
        {name}
      </span>
      <Pin
        size={14}
        className="ml-auto text-[var(--dispatch-text-quaternary)] opacity-50 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

function navItemClass(active: boolean) {
  const base =
    'flex cursor-pointer items-center gap-2.5 rounded-[var(--dispatch-r-md)] px-2.5 py-[7px] text-[13.5px] font-medium no-underline transition-colors'

  if (active) {
    return `${base} bg-[linear-gradient(180deg,var(--dispatch-cobalt-18)_0%,var(--dispatch-cobalt-12)_100%)] text-[var(--dispatch-text-primary)] shadow-[0_0_0_1px_var(--dispatch-cobalt-30)_inset,0_1px_0_oklch(0.85_0.1_264_/_0.18)_inset] [&_svg]:text-[var(--dispatch-cobalt-bright)] [&_svg]:opacity-100`
  }

  return `${base} text-[var(--dispatch-text-secondary)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]`
}
