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
          const item = items[selectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }))

    return (
      <div className="slash-palette">
        {groups.map((group) => (
          <div key={group} className="slash-palette__group">
            <div className="slash-palette__group-label">{group}</div>
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const idx = items.indexOf(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`slash-palette__item${idx === selectedIndex ? ' slash-palette__item--active' : ''}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => command(item)}
                  >
                    <span className="slash-palette__item-label">{item.label}</span>
                    <span className="slash-palette__item-desc">{item.description}</span>
                  </button>
                )
              })}
          </div>
        ))}
        {items.length === 0 && (
          <div className="slash-palette__empty">No commands found</div>
        )}
      </div>
    )
  },
)

CommandPalette.displayName = 'CommandPalette'
