import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { SectionNodeView } from './SectionNodeView'

export const SectionNode = Node.create({
  name: 'section',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      kind: { default: 'custom' },
      title: { default: 'Section' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="section"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionNodeView)
  },
})
