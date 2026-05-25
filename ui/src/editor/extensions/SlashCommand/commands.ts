import type { Editor } from '@tiptap/core'

function insertSection(kind: string, title: string) {
  return (editor: Editor) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'section', attrs: { kind, title } })
      .insertContent({ type: 'paragraph' })
      .run()
  }
}

export type SlashCommand = {
  id: string
  group: string
  label: string
  description: string
  command: (editor: Editor) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'situation',
    group: 'Sections',
    label: 'Situation',
    description: 'Current state or context',
    command: insertSection('situation', 'Situation'),
  },
  {
    id: 'action',
    group: 'Sections',
    label: 'Action',
    description: 'Next step or intended work',
    command: insertSection('action', 'Action'),
  },
  {
    id: 'notes',
    group: 'Sections',
    label: 'Notes',
    description: 'Contextual thoughts',
    command: insertSection('notes', 'Notes'),
  },
  {
    id: 'links',
    group: 'Sections',
    label: 'Links',
    description: 'References and URLs',
    command: insertSection('links', 'Links'),
  },
  {
    id: 'section-custom',
    group: 'Sections',
    label: 'Section',
    description: 'Custom labeled section',
    command: (editor: Editor) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'section', attrs: { kind: 'custom', title: 'Section' } })
        .insertContent({ type: 'paragraph' })
        .run()
    },
  },
  {
    id: 'code',
    group: 'Blocks',
    label: 'Code',
    description: 'Code block',
    command: (editor: Editor) => editor.chain().focus().setCodeBlock().run(),
  },
  {
    id: 'checklist',
    group: 'Blocks',
    label: 'Checklist',
    description: 'Task list',
    command: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
]
