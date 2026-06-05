import { Editor, type JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Markdown } from 'tiptap-markdown'

import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

const markdownExtensions = [
  StarterKit,
  Markdown.configure({
    html: false,
    transformPastedText: false,
    transformCopiedText: false,
  }),
  Placeholder.configure({
    placeholder: '',
    showOnlyWhenEditable: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
]

type MarkdownStorage = {
  parser: { parse(content: string): string | object }
  serializer: { serialize(content: ProseMirrorNode): string }
}

function withMarkdownEditor<T>(run: (editor: Editor) => T): T {
  const editor = new Editor({
    editable: false,
    extensions: markdownExtensions,
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    immediatelyRender: false,
  })

  try {
    const markdown = (editor.storage as { markdown?: MarkdownStorage }).markdown
    if (!markdown) {
      throw new Error('Markdown editor storage is unavailable')
    }

    return run(editor)
  } finally {
    editor.destroy()
  }
}

export function parseMarkdownToDocContent(markdown: string): JSONContent[] {
  if (!markdown.trim()) {
    return []
  }

  return withMarkdownEditor((editor) => {
    editor.commands.setContent(markdown)
    const json = editor.getJSON()
    return Array.isArray(json.content) ? json.content : []
  })
}

export function serializeNodesToMarkdown(
  editor: Editor,
  content: ProseMirrorNode[],
): string {
  if (content.length === 0) {
    return ''
  }

  const miniDoc = editor.state.schema.nodes.doc.create(null, content)
  const markdown =
    (
      editor.storage as { markdown?: MarkdownStorage }
    ).markdown?.serializer.serialize(miniDoc) ?? ''

  return markdown.trimEnd()
}
