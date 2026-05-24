import {
  Calendar,
  FilePenLine,
  Folder,
  History,
  Inbox,
  Play,
  Plus,
  Search,
  Settings,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

import { Kbd } from './primitives'

import type React from 'react'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const navigate = useNavigate()

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dispatch command palette"
      description="Search for a page or action."
      className="dispatch-theme top-[18%] w-[min(760px,calc(100%-32px))] max-w-none translate-x-[-50%] overflow-hidden rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] p-0 text-[var(--dispatch-text-primary)] shadow-[var(--dispatch-shadow-pop)] ring-0 sm:max-w-[min(760px,calc(100%-32px))]"
      showCloseButton={false}
    >
      <Command className="rounded-[var(--dispatch-r-xl)] bg-[var(--dispatch-bg-elevated)] p-0 text-[var(--dispatch-text-primary)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--dispatch-border-soft)] px-4 py-[13px]">
          <Search size={15} className="text-[var(--dispatch-text-tertiary)]" />
          <div className="text-[13px] font-medium text-[var(--dispatch-text-secondary)]">
            Command
          </div>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
        <CommandInput
          placeholder="Search for a page or action…"
          wrapperClassName="p-1.5 pb-0"
          groupClassName="h-11! rounded-[var(--dispatch-r-lg)]! border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] shadow-none!"
          className="px-4 text-[13.5px] text-[var(--dispatch-text-primary)] placeholder:text-[var(--dispatch-text-tertiary)]"
        />
        <CommandList className="max-h-[360px] px-1.5 pb-1.5">
          <CommandEmpty className="py-8 text-[13px] text-[var(--dispatch-text-tertiary)]">
            No matching command.
          </CommandEmpty>
          <CommandGroup
            heading="Jump"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--dispatch-text-quaternary)] [&_[cmdk-group-heading]]:uppercase"
          >
            <PaletteItem
              icon={<Inbox size={14} />}
              label="Open Inbox"
              shortcut={['G', 'I']}
              onSelect={() => run(() => navigate({ to: '/inbox' }))}
            />
            <PaletteItem
              icon={<Folder size={14} />}
              label="Open Projects"
              shortcut={['G', 'P']}
              onSelect={() => run(() => navigate({ to: '/projects' }))}
            />
            <PaletteItem
              icon={<FilePenLine size={14} />}
              label="Open Drafts"
              shortcut={['G', 'D']}
              onSelect={() => run(() => navigate({ to: '/drafts' }))}
            />
            <PaletteItem
              icon={<Settings size={14} />}
              label="Open Settings"
              shortcut={['G', 'S']}
              onSelect={() => run(() => navigate({ to: '/settings' }))}
            />
          </CommandGroup>
          <CommandSeparator className="mx-3 bg-[var(--dispatch-border-soft)]" />
          <CommandGroup
            heading="Actions"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--dispatch-text-quaternary)] [&_[cmdk-group-heading]]:uppercase"
          >
            <PaletteItem
              icon={<Plus size={14} />}
              label="Create issue"
              shortcut={['Ctrl', 'N']}
              onSelect={() => onOpenChange(false)}
            />
            <PaletteItem
              icon={<Play size={14} />}
              label="Resume project: Strophe"
              shortcut={['Ctrl', 'Shift', 'S']}
              onSelect={() => run(() => navigate({ to: '/' }))}
            />
            <PaletteItem
              icon={<FilePenLine size={14} />}
              label="Send issue to Drafts"
              shortcut={['Ctrl', 'Shift', 'D']}
              onSelect={() => run(() => navigate({ to: '/drafts' }))}
            />
            <PaletteItem
              icon={<Calendar size={14} />}
              label="Schedule revisit"
              shortcut={['Ctrl', 'Shift', 'R']}
              onSelect={() => onOpenChange(false)}
            />
            <PaletteItem
              icon={<History size={14} />}
              label="Open last active issue"
              shortcut={['Ctrl', 'Shift', 'L']}
              onSelect={() => run(() => navigate({ to: '/' }))}
            />
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function PaletteItem({
  icon,
  label,
  shortcut,
  onSelect,
}: {
  icon: React.ReactNode
  label: string
  shortcut: string[]
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={label}
      onSelect={onSelect}
      className="gap-3 rounded-[var(--dispatch-r-md)] px-3 py-2.5 text-[13.5px] font-medium text-[var(--dispatch-text-primary)] data-selected:bg-transparent data-selected:[background-image:linear-gradient(180deg,var(--dispatch-cobalt-18)_0%,var(--dispatch-cobalt-12)_100%)] data-selected:text-[var(--dispatch-text-primary)] data-selected:shadow-[0_0_0_1px_var(--dispatch-cobalt-30)_inset,0_1px_0_oklch(0.85_0.1_264_/_0.18)_inset] data-selected:[&_div:first-child]:bg-[var(--dispatch-cobalt)] data-selected:[&_div:first-child]:text-white data-selected:[&_div:first-child]:shadow-[0_0_0_1px_oklch(0.85_0.1_264_/_0.4)_inset] data-selected:[&_div:first-child_svg]:text-white"
    >
      <div className="grid h-[26px] w-[26px] place-items-center rounded-[var(--dispatch-r-sm)] bg-[var(--dispatch-bg-hover)] text-[var(--dispatch-text-secondary)]">
        {icon}
      </div>
      <div className="flex-1">{label}</div>
      <CommandShortcut className="inline-flex items-center gap-1 font-sans tracking-normal text-[var(--dispatch-text-tertiary)] group-data-selected/command-item:text-[var(--dispatch-text-secondary)]">
        {shortcut.map((key) => (
          <Kbd key={`${label}-${key}`}>{key}</Kbd>
        ))}
      </CommandShortcut>
    </CommandItem>
  )
}
