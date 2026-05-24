import { FilePenLine, Play } from 'lucide-react'

import { WorkListPage } from './work-list-page'
import { continueIssues, draftIssues, pageCopy } from '../../data/dispatch'

export function DraftsPage() {
  return (
    <WorkListPage
      title={pageCopy.Drafts.title}
      subtitle={pageCopy.Drafts.subtitle}
      sections={[
        {
          title: 'Ready to shape',
          tone: 'amber',
          icon: <FilePenLine size={14} />,
          issues: draftIssues,
        },
        {
          title: 'Recent momentum',
          icon: <Play size={14} />,
          issues: continueIssues.slice(0, 1),
        },
      ]}
    />
  )
}
