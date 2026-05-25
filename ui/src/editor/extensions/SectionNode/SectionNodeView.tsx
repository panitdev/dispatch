import { NodeViewWrapper } from '@tiptap/react'
import { useRef, useState } from 'react'

import type { ReactNodeViewProps } from '@tiptap/react'

const KIND_META: Record<string, { label: string; icon: string }> = {
  situation: { label: 'Situation', icon: '◎' },
  action: { label: 'Action', icon: '→' },
  notes: { label: 'Notes', icon: '·' },
  links: { label: 'Links', icon: '⌁' },
  custom: { label: '', icon: '§' },
}

export function SectionNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: ReactNodeViewProps) {
  const meta = KIND_META[node.attrs.kind as string] ?? KIND_META.custom
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState((node.attrs.title as string) || meta.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitTitle = () => {
    updateAttributes({ title })
    setEditing(false)
  }

  return (
    <NodeViewWrapper
      as="div"
      data-kind={node.attrs.kind}
      contentEditable={false}
      className={`section-node${selected ? ' section-node--selected' : ''}`}
    >
      <span className="section-node__icon">{meta.icon}</span>

      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTitle()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="section-node__title-input"
          autoFocus
        />
      ) : (
        <span
          className="section-node__title"
          onDoubleClick={() => setEditing(true)}
        >
          {title}
        </span>
      )}

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
