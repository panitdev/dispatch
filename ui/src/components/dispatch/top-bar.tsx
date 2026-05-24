import { ChevronDown, Moon, Plus, Search, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from '@/components/ui/button-group'

import { Kbd } from './primitives'

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = mounted && resolvedTheme === 'light'

  return (
    <header className="flex items-center gap-3 border-b border-[var(--dispatch-border-soft)] px-3 py-3 md:px-6 md:py-3.5">
      <button
        type="button"
        onClick={onOpenCommand}
        className="flex min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-[var(--dispatch-r-lg)] border border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-3.5 py-[9px] text-left text-[13.5px] text-[var(--dispatch-text-tertiary)] transition-colors hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] md:max-w-[560px]"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 truncate">Search or jump…</span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <ButtonGroup>
        <Button
          size="sm"
          className="border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]"
        >
          <Plus size={15} />
          Capture
        </Button>
        <ButtonGroupSeparator className="bg-[var(--dispatch-cta-divider)]" />
        <Button
          size="icon-sm"
          className="border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]"
          aria-label="Capture options"
        >
          <ChevronDown size={14} />
        </Button>
      </ButtonGroup>

      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-secondary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] hover:text-[var(--dispatch-text-primary)]"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      >
        {isLight ? <Moon size={14} /> : <Sun size={14} />}
        <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="ml-auto rounded-full border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] py-1 pr-2 pl-1 text-[var(--dispatch-text-secondary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] hover:text-[var(--dispatch-text-primary)]"
      >
        <span className="relative block h-[30px] w-[30px] overflow-hidden rounded-full bg-[linear-gradient(135deg,oklch(0.62_0.12_60),oklch(0.45_0.10_30))] before:absolute before:top-[28%] before:left-1/2 before:aspect-square before:w-[32%] before:-translate-x-1/2 before:rounded-full before:bg-[oklch(0.85_0.05_60)] after:absolute after:bottom-[-12%] after:left-1/2 after:aspect-square after:w-3/4 after:-translate-x-1/2 after:rounded-full after:bg-[oklch(0.85_0.05_60)]">
          <span className="absolute right-px bottom-px z-10 h-[9px] w-[9px] rounded-full bg-[var(--dispatch-green)] shadow-[0_0_0_2px_var(--dispatch-bg-surface)]" />
        </span>
        <ChevronDown size={14} />
      </Button>
    </header>
  )
}
