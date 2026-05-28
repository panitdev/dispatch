import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import 'tippy.js/dist/tippy.css'

import { extensions } from '#/editor/extensions'
import { deserializeFromBlocks, serializeToBlocks } from '#/editor/serialization/blocks'
import { buildDefaultContent } from '#/editor/templates'

import type { IssueBodyBlock } from '#/editor/serialization/blocks'

export type { IssueBodyBlock }

interface IssueEditorProps {
  initialBlocks?: IssueBodyBlock[]
  onChange?: (blocks: IssueBodyBlock[]) => void
  placeholder?: string
}

export function IssueEditor({ initialBlocks, onChange, placeholder }: IssueEditorProps) {
  const resolvedExtensions = placeholder
    ? [
        ...extensions.filter((ext) => ext.name !== 'placeholder'),
        Placeholder.configure({ placeholder: () => placeholder }),
      ]
    : extensions

  const editor = useEditor({
    extensions: resolvedExtensions,
    content: initialBlocks ? deserializeFromBlocks(initialBlocks) : buildDefaultContent(),
    onUpdate: ({ editor: e }) => {
      onChange?.(serializeToBlocks(e))
    },
    editorProps: {
      attributes: {
        class: 'issue-editor outline-none text-sm leading-[1.65] text-[var(--dispatch-text-primary)] caret-[var(--dispatch-cobalt-bright)]',
        spellcheck: 'true',
      },
    },
    immediatelyRender: false,
  })

  return (
    <div className="min-h-40">
      <EditorContent editor={editor} />
    </div>
  )
}
