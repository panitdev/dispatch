const DEFAULT_SECTIONS = [
  { kind: 'situation', title: 'Situation' },
  { kind: 'action', title: 'Action' },
]

export function buildDefaultContent(): object {
  return {
    type: 'doc',
    content: DEFAULT_SECTIONS.flatMap(({ kind, title }) => [
      { type: 'section', attrs: { kind, title } },
      { type: 'paragraph' },
    ]),
  }
}
