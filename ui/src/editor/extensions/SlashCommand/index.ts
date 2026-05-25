import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'

import { CommandPalette } from './CommandPalette'
import { SLASH_COMMANDS } from './commands'

import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { SlashCommand as SlashCommandItem } from './commands'
import type { Instance as TippyInstance } from 'tippy.js'

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
          let component: ReactRenderer | undefined
          let popup: TippyInstance | undefined

          return {
            onStart(props: SuggestionProps<SlashCommandItem>) {
              component = new ReactRenderer(CommandPalette, {
                props,
                editor: props.editor,
              })

              if (!props.clientRect) return

              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                arrow: false,
                maxWidth: 'none',
                offset: [0, 6],
                theme: 'slash-command',
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },

            onUpdate(props: SuggestionProps<SlashCommandItem>) {
              component?.updateProps(props)
              if (props.clientRect) {
                popup?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
              }
            },

            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              const ref = component?.ref as
                | { onKeyDown?: (p: SuggestionKeyDownProps) => boolean }
                | undefined
              return ref?.onKeyDown?.(props) ?? false
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
