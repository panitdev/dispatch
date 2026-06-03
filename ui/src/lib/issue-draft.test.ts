import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearIssueDraft, loadIssueDraft, saveIssueDraft } from './issue-draft'
import type { IssueDraft } from './issue-draft'

const sample: IssueDraft = {
  title: 'Fix the thing',
  projectId: 'proj_1',
  status: 'next',
  labels: ['bug'],
  blocks: [{ id: 'b1', kind: 'paragraph', content: 'hello' }],
}

describe('issue-draft', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('round-trips a draft through sessionStorage', () => {
    saveIssueDraft(sample)
    expect(loadIssueDraft()).toEqual(sample)
  })

  it('returns null when nothing is stored', () => {
    expect(loadIssueDraft()).toBeNull()
  })

  it('does not persist an empty draft', () => {
    saveIssueDraft({
      title: '   ',
      projectId: 'proj_1',
      status: 'draft',
      labels: [],
      blocks: [],
    })
    expect(loadIssueDraft()).toBeNull()
  })

  it('clears a stored draft', () => {
    saveIssueDraft(sample)
    clearIssueDraft()
    expect(loadIssueDraft()).toBeNull()
  })

  it('tolerates corrupt JSON', () => {
    window.sessionStorage.setItem('dispatch:draft:new-issue', '{not json')
    expect(loadIssueDraft()).toBeNull()
  })
})
