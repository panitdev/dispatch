import { Calendar, Clock, Command, History, Play, Plus } from 'lucide-react'

import { Kbd } from './primitives'

const commands = [
  {
    label: 'Create issue',
    icon: <Plus size={14} />,
    keys: ['⌘', 'N'],
    active: true,
  },
  {
    label: 'Resume project: Strophe',
    icon: <Play size={14} />,
    keys: ['⌘', '⇧', 'S'],
  },
  {
    label: 'Move issue to Waiting',
    icon: <Clock size={14} />,
    keys: ['⌘', '⇧', 'W'],
  },
  {
    label: 'Schedule revisit',
    icon: <Calendar size={14} />,
    keys: ['⌘', '⇧', 'D'],
  },
  {
    label: 'Open last active issue',
    icon: <History size={14} />,
    keys: ['⌘', '⇧', 'L'],
  },
]

export function CommandPalette() {
  return (
    <div
      className="absolute right-3 bottom-6 left-3 z-30 overflow-hidden rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] shadow-[var(--dispatch-shadow-pop)] md:right-auto md:bottom-14 md:left-1/2 md:w-[min(480px,calc(100%-48px))] md:-translate-x-[22%]"
      role="dialog"
      aria-label="Command palette"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--dispatch-border-soft)] px-4 py-[13px]">
        <Command size={15} className="text-[var(--dispatch-text-tertiary)]" />
        <div className="text-[13px] font-medium text-[var(--dispatch-text-secondary)]">
          Command
        </div>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>
      <div className="flex flex-col gap-px p-1.5">
        {commands.map((command) => (
          <div
            className={`flex cursor-pointer items-center gap-3 rounded-[var(--dispatch-r-md)] px-3 py-2.5 transition-colors hover:bg-[var(--dispatch-bg-hover)] ${command.active ? 'bg-[linear-gradient(180deg,var(--dispatch-cobalt-18)_0%,var(--dispatch-cobalt-12)_100%)] shadow-[0_0_0_1px_var(--dispatch-cobalt-30)_inset]' : ''}`}
            key={command.label}
          >
            <div
              className={`grid h-[26px] w-[26px] place-items-center rounded-[var(--dispatch-r-sm)] ${command.active ? 'bg-[var(--dispatch-cobalt)] text-white shadow-[0_0_0_1px_oklch(0.85_0.1_264_/_0.4)_inset]' : 'bg-[var(--dispatch-bg-hover)] text-[var(--dispatch-text-secondary)]'}`}
            >
              {command.icon}
            </div>
            <div className="flex-1 text-[13.5px] font-medium text-[var(--dispatch-text-primary)]">
              {command.label}
            </div>
            <span className="inline-flex items-center gap-1">
              {command.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
