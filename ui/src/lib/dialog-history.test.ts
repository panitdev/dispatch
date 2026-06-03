import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetDialogHistory,
  detachTopDialog,
  popDialog,
  pushDialog,
} from './dialog-history'

function setViewport(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

/** Emulate the browser reverting to a given dialog depth on back navigation. */
function simulateBackTo(depth: number) {
  window.history.replaceState(
    depth > 0 ? { __dispatchDialogDepth: depth } : null,
    '',
    depth > 0 ? `#~${depth}` : '/',
  )
  window.dispatchEvent(
    new PopStateEvent('popstate', { state: window.history.state }),
  )
}

describe('dialog-history (mobile)', () => {
  beforeEach(() => {
    setViewport(true)
    window.history.replaceState(null, '', '/')
    __resetDialogHistory()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pushes a dummy history entry with a hash nonce', () => {
    const entry = pushDialog(() => {})
    expect(entry).not.toBeNull()
    expect(window.location.hash).toBe('#~1')
    expect(
      (window.history.state as { __dispatchDialogDepth?: number })
        .__dispatchDialogDepth,
    ).toBe(1)
  })

  it('closes the top dialog when the back button pops its entry', () => {
    const onClose = vi.fn()
    pushDialog(onClose)

    simulateBackTo(0)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('programmatic close removes the entry via history.back without double-closing', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const onClose = vi.fn()
    const entry = pushDialog(onClose)

    popDialog(entry)

    expect(back).toHaveBeenCalledTimes(1)
    // A stray popstate from the back navigation must not re-close it.
    simulateBackTo(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes nested dialogs top-first, one per back navigation', () => {
    const closeA = vi.fn()
    const closeB = vi.fn()
    pushDialog(closeA)
    pushDialog(closeB)

    simulateBackTo(1)
    expect(closeB).toHaveBeenCalledTimes(1)
    expect(closeA).not.toHaveBeenCalled()

    simulateBackTo(0)
    expect(closeA).toHaveBeenCalledTimes(1)
  })

  it('detachTopDialog removes the entry without navigating back', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const entry = pushDialog(() => {})

    expect(detachTopDialog()).toBe(true)
    // Entry is gone from the stack, so a later close is a no-op.
    popDialog(entry)
    expect(back).not.toHaveBeenCalled()
  })
})

describe('dialog-history (desktop)', () => {
  beforeEach(() => {
    setViewport(false)
    window.history.replaceState(null, '', '/')
    __resetDialogHistory()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('never touches history and returns no entry', () => {
    const entry = pushDialog(() => {})
    expect(entry).toBeNull()
    expect(window.location.hash).toBe('')
    expect(detachTopDialog()).toBe(false)
  })
})
