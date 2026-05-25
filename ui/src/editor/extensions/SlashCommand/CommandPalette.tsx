import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

import type { SlashCommand } from './commands'

type CommandPaletteProps = {
  items: SlashCommand[]
  command: (item: SlashCommand) => void
}

type CommandPaletteHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const CommandPalette = forwardRef<CommandPaletteHandle, CommandPaletteProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const groups = [...new Set(items.map((i) => i.group))]

    useEffect(() => setSelectedIndex(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: { event: KeyboardEvent }) {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => Math.max(0, i - 1))
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
          return true
        }
        if (event.key === 'Enter') {
          if (items.length > 0) command(items[selectedIndex])
          return true
        }
        return false
      },
    }))

    return (
      <div className="dispatch-theme overflow-hidden min-w-[228px] max-w-[280px] p-1.5 text-[var(--dispatch-text-primary)] bg-[var(--dispatch-bg-elevated)] border border-[var(--dispatch-border-strong)] rounded-[var(--dispatch-r-md)] shadow-[var(--dispatch-shadow-pop)] font-sans">
        {groups.map((group) => (
          <div key={group} className="pb-1.5 mb-1.5 border-b border-[var(--dispatch-border-soft)] last:pb-0 last:mb-0 last:border-b-0">
            <div className="px-2 pt-[5px] pb-1.5 text-[10px] font-bold leading-none tracking-[0.11em] uppercase text-[var(--dispatch-text-quaternary)]">
              {group}
            </div>
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const idx = items.indexOf(item)
                const Icon = item.icon
                const isActive = idx === selectedIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`group flex items-center gap-2.5 w-full min-h-[34px] py-1.5 px-2 rounded-[calc(var(--dispatch-r-sm)-1px)] cursor-pointer text-left text-[var(--dispatch-text-primary)] hover:bg-[var(--dispatch-bg-hover)] ${isActive ? 'bg-[var(--dispatch-bg-hover)]' : 'bg-transparent'}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => command(item)}
                  >
                    <span className={`flex items-center justify-center w-[17px] h-[17px] shrink-0 group-hover:text-[var(--dispatch-text-secondary)] ${isActive ? 'text-[var(--dispatch-text-secondary)]' : 'text-[var(--dispatch-text-tertiary)]'}`}>
                      <Icon size={14} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 font-medium text-[13px] leading-[1.25] text-inherit flex-1">
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <span className="ml-2.5 text-[11px] leading-none text-[var(--dispatch-text-tertiary)] [font-feature-settings:'tnum'] whitespace-nowrap shrink-0">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-2 text-[13px] text-[var(--dispatch-text-tertiary)] text-center">
            No commands found
          </div>
        )}
      </div>
    )
  },
)

CommandPalette.displayName = 'CommandPalette'
