/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'

import { extensions } from '#/editor/extensions'

import { deserializeFromBlocks, serializeToBlocks } from './blocks'
import type { IssueBodyBlock } from './blocks'

describe('issue body block serialization', () => {
  it('serializes code blocks without truncating following content', () => {
    const editor = new Editor({
      extensions,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Intro' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'ts' },
            content: [{ type: 'text', text: 'const value = 1' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After fence' }],
          },
        ],
      },
      immediatelyRender: false,
    })

    try {
      expect(serializeToBlocks(editor)).toEqual([
        {
          id: expect.any(String),
          kind: 'markdown',
          content: 'Intro\n\n```ts\nconst value = 1\n```\n\nAfter fence',
        },
      ])
    } finally {
      editor.destroy()
    }
  })

  it('parses markdown blocks into structured editor content', () => {
    const blocks: IssueBodyBlock[] = [
      {
        id: 'block-1',
        kind: 'markdown',
        content: '```ts\nconst value = 1\n```\n\nAfter fence',
      },
    ]

    expect(deserializeFromBlocks(blocks)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const value = 1' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After fence' }],
        },
      ],
    })
  })

  it('keeps freeform markdown unsectioned before semantic dividers', () => {
    const editor = new Editor({
      extensions,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Loose notes' }],
          },
          { type: 'section', attrs: { kind: 'situation', title: 'Situation' } },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Current state' }],
          },
        ],
      },
      immediatelyRender: false,
    })

    try {
      expect(serializeToBlocks(editor)).toEqual([
        {
          id: expect.any(String),
          kind: 'markdown',
          content: 'Loose notes',
        },
        {
          id: expect.any(String),
          kind: 'situation',
          title: 'Situation',
          content: 'Current state',
        },
      ])
    } finally {
      editor.destroy()
    }
  })
})
