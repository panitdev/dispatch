import { EditorContent, useEditor } from '@tiptap/react'
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

export function IssueEditor({ initialBlocks, onChange }: IssueEditorProps) {
  const editor = useEditor({
    extensions,
    content: initialBlocks ? deserializeFromBlocks(initialBlocks) : buildDefaultContent(),
    onUpdate: ({ editor: e }) => {
      onChange?.(serializeToBlocks(e))
    },
    editorProps: {
      attributes: {
        class: 'issue-editor',
        spellcheck: 'true',
      },
    },
    immediatelyRender: false,
  })

  return (
    <div className="issue-editor-wrap">
      <EditorContent editor={editor} />
    </div>
  )
}
