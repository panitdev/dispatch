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
      className={`group flex items-center gap-2 mt-[18px] mb-2 select-none text-[var(--dispatch-text-primary)] text-[13.5px] font-bold tracking-normal leading-[1.3] normal-case${selected ? ' outline outline-1 outline-[var(--dispatch-cobalt-30)] rounded' : ''}`}
    >
      <BookOpen className="text-[var(--dispatch-cobalt-bright)] shrink-0" size={16} strokeWidth={2} />
      <span className="cursor-default flex-1">{title}</span>

      <button
        className="ml-auto opacity-0 group-hover:opacity-60 bg-transparent cursor-pointer text-inherit text-sm leading-none px-0.5 py-0"
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
