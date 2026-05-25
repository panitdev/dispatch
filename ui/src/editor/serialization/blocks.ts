import { nanoid } from 'nanoid'
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown'

import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { MarkdownSerializerState } from 'prosemirror-markdown'

export type IssueBodyBlock = {
  id: string
  kind: string
  title?: string
  content: string
  metadata?: Record<string, unknown>
}

const issueMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    section(state: MarkdownSerializerState, node: ProseMirrorNode) {
      state.write(`## ${node.attrs.title as string}\n\n`)
    },
    taskList(state: MarkdownSerializerState, node: ProseMirrorNode) {
      state.renderList(node, '  ', () => '- ')
    },
    taskItem(state: MarkdownSerializerState, node: ProseMirrorNode) {
      state.write(node.attrs.checked ? '[x] ' : '[ ] ')
      state.renderInline(node)
      state.closeBlock(node)
    },
  },
  defaultMarkdownSerializer.marks,
)

export function serializeToBlocks(editor: Editor): IssueBodyBlock[] {
  const doc = editor.state.doc
  const blocks: IssueBodyBlock[] = []
  let current: IssueBodyBlock | null = null
  let contentNodes: ProseMirrorNode[] = []

  function flushCurrent() {
    if (!current) return
    if (contentNodes.length > 0) {
      const miniDoc = doc.type.schema.nodes.doc.create(null, contentNodes)
      current.content = issueMarkdownSerializer.serialize(miniDoc)
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
  const content: object[] = []

  for (const block of blocks) {
    if (block.kind !== 'markdown') {
      content.push({
        type: 'section',
        attrs: { kind: block.kind, title: block.title ?? block.kind },
      })
    }

    if (block.content.trim()) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: block.content }],
      })
    } else {
      content.push({ type: 'paragraph' })
    }
  }

  if (content.length === 0) {
    content.push({ type: 'paragraph' })
  }

  return { type: 'doc', content }
}
