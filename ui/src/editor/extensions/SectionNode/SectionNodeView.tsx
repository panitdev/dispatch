import { NodeViewWrapper } from '@tiptap/react'
import { BookOpen } from 'lucide-react'

import type { ReactNodeViewProps } from '@tiptap/react'

const KIND_META: Record<string, { label: string }> = {
  situation: { label: 'Situation' },
  action: { label: 'Action' },
  notes: { label: 'Notes' },
  links: { label: 'Links' },
  custom: { label: 'Section' },
}

export function SectionNodeView({
  node,
  deleteNode,
  selected,
}: ReactNodeViewProps) {
  const meta = KIND_META[node.attrs.kind as string] ?? KIND_META.custom
  const title = (node.attrs.title as string) || meta.label

  return (
    <NodeViewWrapper
      as="div"
      data-kind={node.attrs.kind}
      contentEditable={false}
      className={`section-node${selected ? ' section-node--selected' : ''}`}
    >
      <BookOpen className="section-node__icon" size={16} strokeWidth={2} />
      <span className="section-node__title">{title}</span>

      <button
        className="section-node__delete"
        onClick={deleteNode}
        tabIndex={-1}
        aria-label="Remove section"
        type="button"
      >
        ×
      </button>
    </NodeViewWrapper>
  )
}
