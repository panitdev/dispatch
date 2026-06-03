import type { IssueBodyBlock } from '#/components/dispatch/IssueEditor'

/**
 * Issue-creation draft persistence.
 *
 * The creation form is ephemeral UI (it is not represented in the URL), but its
 * in-progress contents are persisted to `sessionStorage` so a tab refresh does
 * not lose work. The draft is restored when the dialog reopens and cleared once
 * an issue is successfully created.
 */

const DRAFT_KEY = 'dispatch:draft:new-issue'

export type IssueDraft = {
  title: string
  projectId: string
  status: string
  labels: string[]
  blocks: IssueBodyBlock[]
}

function isEmpty(draft: IssueDraft): boolean {
  return (
    draft.title.trim() === '' &&
    draft.blocks.length === 0 &&
    draft.labels.length === 0
  )
}

export function loadIssueDraft(): IssueDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<IssueDraft>
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : '',
      status: typeof parsed.status === 'string' ? parsed.status : 'draft',
      labels: Array.isArray(parsed.labels) ? parsed.labels : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    }
  } catch {
    return null
  }
}

export function saveIssueDraft(draft: IssueDraft): void {
  if (typeof window === 'undefined') return
  try {
    // Don't keep an empty draft lingering in storage.
    if (isEmpty(draft)) {
      window.sessionStorage.removeItem(DRAFT_KEY)
      return
    }
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Ignore quota / serialization errors — drafts are best-effort.
  }
}

export function clearIssueDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}
