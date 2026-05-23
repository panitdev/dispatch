import { History } from 'lucide-react'

import { WorkListPage } from './work-list-page'
import { archiveIssues, pageCopy } from '../../data/dispatch'

export function ArchivePage() {
  return (
    <WorkListPage
      title={pageCopy.Archive.title}
      subtitle={pageCopy.Archive.subtitle}
      sections={[
        {
          title: 'Recently touched',
          tone: 'muted',
          icon: <History size={14} />,
          issues: archiveIssues,
        },
      ]}
    />
  )
}
