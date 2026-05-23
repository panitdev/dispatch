import {
  Archive,
  Clock,
  Folder,
  Home,
  Inbox,
  Network,
  PanelLeft,
  Pin,
  Settings,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

import { ProjectGlyph } from './primitives'

import type { DispatchPage, ProjectKey } from '../../data/dispatch'

export function Sidebar({ active }: { active: DispatchPage }) {
  const nav = [
    { label: 'Now' as const, to: '/', icon: Home },
    { label: 'Inbox' as const, to: '/inbox', icon: Inbox, count: 7 },
    { label: 'Projects' as const, to: '/projects', icon: Folder },
    { label: 'Waiting' as const, to: '/waiting', icon: Clock },
    { label: 'Archive' as const, to: '/archive', icon: Archive },
  ]

  return (
    <aside className="hidden min-h-0 flex-col border-r border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-2.5 pt-3.5 pb-3 md:flex">
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-[18px]">
        <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-[linear-gradient(135deg,var(--dispatch-cobalt)_0%,oklch(0.55_0.22_280)_100%)] text-white shadow-[0_1px_0_oklch(0.85_0.1_264_/_0.3)_inset,0_4px_10px_-4px_oklch(0.55_0.22_280_/_0.5)]">
          <Network size={16} strokeWidth={2} />
        </div>
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
