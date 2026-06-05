import MarkdownIt from 'markdown-it'

import { cn } from '@/lib/utils'

const markdown = MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
})

const defaultRenderLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]?.attrSet('target', '_blank')
  tokens[idx]?.attrSet('rel', 'noreferrer noopener')
  return defaultRenderLinkOpen(tokens, idx, options, env, self)
}

export function MarkdownContent({
  markdown: source,
  className,
}: {
  markdown: string
  className?: string
}) {
  return (
    <div
      className={cn('dispatch-markdown', className)}
      dangerouslySetInnerHTML={{ __html: markdown.render(source) }}
    />
  )
}
