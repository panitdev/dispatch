import { nanoid } from 'nanoid'

import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { parseMarkdownToDocContent, serializeNodesToMarkdown } from './markdown'

export type IssueBodyBlock = {
  id: string
  kind: string
  title?: string
  content: string
  metadata?: Record<string, unknown>
}

export function serializeToBlocks(editor: Editor): IssueBodyBlock[] {
  const doc = editor.state.doc
  const blocks: IssueBodyBlock[] = []
  let current: IssueBodyBlock | null = null
  let contentNodes: ProseMirrorNode[] = []

  function flushCurrent() {
    if (!current) return
    if (contentNodes.length > 0) {
      current.content = serializeNodesToMarkdown(editor, contentNodes)
    }
    blocks.push(current)
    contentNodes = []
    current = null
  }

  doc.forEach((node) => {
    if (node.type.name === 'section') {
      flushCurrent()
      current = {
        id: nanoid(),
        kind: node.attrs.kind as string,
        title: node.attrs.title as string,
        content: '',
      }
    } else {
      if (!current) {
        current = { id: nanoid(), kind: 'markdown', content: '' }
      }
      contentNodes.push(node)
    }
  })

  flushCurrent()
  return blocks
}

export function deserializeFromBlocks(blocks: IssueBodyBlock[]): object {
  const content: JSONContent[] = []

  for (const block of blocks) {
    if (block.kind !== 'markdown') {
      content.push({
        type: 'section',
        attrs: { kind: block.kind, title: block.title ?? block.kind },
      })
    }

    if (block.content.trim()) {
      content.push(...parseMarkdownToDocContent(block.content))
    } else if (block.kind !== 'markdown') {
      content.push({ type: 'paragraph' })
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }

  return { type: 'doc', content }
}
