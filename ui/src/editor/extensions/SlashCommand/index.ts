import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'

import { CommandPalette } from './CommandPalette'
import { SLASH_COMMANDS } from './commands'

import type { Editor } from '@tiptap/core'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { SlashCommand as SlashCommandItem } from './commands'

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,

        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },

        items: ({ query }: { query: string }) =>
          SLASH_COMMANDS.filter((cmd) =>
            cmd.label.toLowerCase().startsWith(query.toLowerCase()),
          ),

        render: () => {
          let component: ReactRenderer
          let popup: TippyInstance

          return {
            onStart(props: SuggestionProps<SlashCommandItem>) {
              component = new ReactRenderer(CommandPalette, {
                props,
                editor: props.editor as Editor,
              })

              if (!props.clientRect) return

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },

            onUpdate(props: SuggestionProps<SlashCommandItem>) {
              component.updateProps(props)
              if (props.clientRect) {
                popup?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
              }
            },

            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              return (component.ref as { onKeyDown?: (p: SuggestionKeyDownProps) => boolean })?.onKeyDown?.(props) ?? false
            },

            onExit() {
              popup?.destroy()
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
