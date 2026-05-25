import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Markdown } from 'tiptap-markdown'

import { SectionNode } from './SectionNode'
import { SlashCommand } from './SlashCommand'

export const extensions = [
  StarterKit,
  Markdown.configure({
    html: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'paragraph') return 'Write, or / for commands…'
      return ''
    },
    showOnlyWhenEditable: true,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  SectionNode,
  SlashCommand,
]
