import type { Editor } from '@tiptap/core'
import type { ComponentType } from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code2,
  Quote,
  ArrowRight,
  StickyNote,
  Link2,
  Rows3,
  CircleDot,
} from 'lucide-react'

export type SlashCommandContext = {
  editor: Editor
  range: { from: number; to: number }
}

export type SlashCommand = {
  id: string
  group: string
  label: string
  shortcut?: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  command: (ctx: SlashCommandContext) => void
}

function insertSection(kind: string, title: string) {
  return ({ editor, range }: SlashCommandContext) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .command(({ tr, state }) => {
        const { $from } = tr.selection
        const sectionNode = state.schema.nodes.section?.create({ kind, title })
        const paraNode = state.schema.nodes.paragraph?.create()
        if (!sectionNode || !paraNode) return false
        tr.replaceWith($from.before(), $from.after(), [sectionNode, paraNode])
        return true
      })
      .run()
  }
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'heading1',
    group: 'Format',
    label: 'Heading 1',
    shortcut: 'Ctrl Alt 1',
    icon: Heading1,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    id: 'heading2',
    group: 'Format',
    label: 'Heading 2',
    shortcut: 'Ctrl Alt 2',
    icon: Heading2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    id: 'heading3',
    group: 'Format',
    label: 'Heading 3',
    shortcut: 'Ctrl Alt 3',
    icon: Heading3,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet-list',
    group: 'Format',
    label: 'Bullet list',
    shortcut: 'Ctrl ⇧ 8',
    icon: List,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: 'numbered-list',
    group: 'Format',
    label: 'Numbered list',
    shortcut: 'Ctrl ⇧ 9',
    icon: ListOrdered,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: 'checklist',
    group: 'Format',
    label: 'Checklist',
    shortcut: 'Ctrl ⇧ 7',
    icon: ListChecks,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    group: 'Format',
    label: 'Blockquote',
    icon: Quote,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    id: 'code',
    group: 'Format',
    label: 'Code block',
    shortcut: 'Ctrl ⇧ \\',
    icon: Code2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCodeBlock().run(),
  },
  {
    id: 'situation',
    group: 'Sections',
    label: 'Situation',
    icon: CircleDot,
    command: insertSection('situation', 'Situation'),
  },
  {
    id: 'action',
    group: 'Sections',
    label: 'Action',
    icon: ArrowRight,
    command: insertSection('action', 'Action'),
  },
  {
    id: 'notes',
    group: 'Sections',
    label: 'Notes',
    icon: StickyNote,
    command: insertSection('notes', 'Notes'),
  },
  {
    id: 'links',
    group: 'Sections',
    label: 'Links',
    icon: Link2,
    command: insertSection('links', 'Links'),
  },
  {
    id: 'section-custom',
    group: 'Sections',
    label: 'Section',
    icon: Rows3,
    command: insertSection('custom', 'Section'),
  },
]
