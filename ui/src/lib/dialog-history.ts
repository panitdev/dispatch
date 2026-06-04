/**
 * Mobile ephemeral-UI history manager.
 *
 * On mobile web users expect the browser back button to close the top-most
 * ephemeral dialog — creation forms, filter panels, action sheets, confirmation
 * dialogs — rather than leave the application. We achieve this with "dummy"
 * history entries: every time an ephemeral dialog opens we push a history entry
 * tagged with a hash nonce (`/` → `/#~1` → `/#~2`). The actual UI state lives in
 * the in-memory stack below; the history entries exist only so the back button
 * has something to pop.
 *
 * Resource modals (issue detail routes) are intentionally NOT managed here —
 * they use real routing with the URL as the source of truth.
 *
 * Desktop never pushes history entries; ephemeral dialogs there are pure local
 * state. Every function below is therefore a no-op when the viewport is not
 * mobile (or while server-rendering).
 */

const MOBILE_MAX_WIDTH = 767
const STATE_KEY = '__dispatchDialogDepth'

export type DialogEntry = {
  readonly onClose: () => void
}

let stack: DialogEntry[] = []
let listening = false

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
}

function currentDepth(): number {
  if (typeof window === 'undefined') return 0
  const state = window.history.state as Record<string, unknown> | null
  const depth = state?.[STATE_KEY]
  return typeof depth === 'number' ? depth : 0
}

function ensureListening(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', handlePopState)
}

/**
 * Reconcile the in-memory stack against the live history depth. Any dialog
 * whose backing history entry has been popped (back button) is closed, top
 * first. This is idempotent: it only closes dialogs that lost their history
 * entry, so a programmatic close that calls `history.back()` does not trigger a
 * second close.
 */
function handlePopState(): void {
  const depth = currentDepth()
  while (stack.length > depth) {
    const entry = stack.pop()!
    entry.onClose()
  }
}

/**
 * Register an opened ephemeral dialog and push its dummy history entry. Returns
 * the entry handle (used to close it later), or `null` on desktop where no
 * history bookkeeping happens.
 */
export function pushDialog(onClose: () => void): DialogEntry | null {
  if (!isMobileViewport()) return null
  ensureListening()

  const entry: DialogEntry = { onClose }
  stack.push(entry)

  const depth = stack.length
  window.history.pushState(
    { ...window.history.state, [STATE_KEY]: depth },
    '',
    `#~${depth}`,
  )

  return entry
}

/**
 * Programmatically close a dialog (cancel/submit button, escape, outside tap).
 * Removes its dummy history entry by navigating back. If the entry was already
 * popped by the back button this is a no-op, so it is always safe to call.
 */
export function popDialog(entry: DialogEntry | null): void {
  if (!entry) return

  const index = stack.indexOf(entry)
  if (index === -1) return // already closed via the back button

  // Only the top entry owns the current history position. If a lower entry is
  // closed first (rare), drop it from the stack without touching history; the
  // surplus history entry is reconciled on the next back navigation.
  const isTop = index === stack.length - 1
  stack.splice(index, 1)

  if (isTop && isMobileViewport() && currentDepth() > stack.length) {
    window.history.back()
  }
}

/**
 * Detach the top dialog's history entry from the in-memory stack WITHOUT
 * navigating back, for the case where the caller is about to replace the current
 * history entry itself (e.g. issue creation success navigates to the new issue
 * with `replace: true`, overwriting the dialog's dummy entry).
 *
 * Returns `true` when an entry was detached (mobile, an entry existed), letting
 * the caller decide between `replace` (mobile) and `push` (desktop) navigation.
 */
export function detachTopDialog(): boolean {
  if (stack.length === 0) return false
  stack.pop()
  return true
}

/** Test-only: reset module state between cases. */
export function __resetDialogHistory(): void {
  stack = []
}
