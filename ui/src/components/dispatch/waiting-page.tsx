import { Clock, Play } from 'lucide-react'

import { WorkListPage } from './work-list-page'
import { continueIssues, pageCopy, waitingIssues } from '../../data/dispatch'

export function WaitingPage() {
  return (
    <WorkListPage
      title={pageCopy.Waiting.title}
      subtitle={pageCopy.Waiting.subtitle}
      sections={[
        {
          title: 'Waiting on',
          tone: 'amber',
          icon: <Clock size={14} />,
          issues: waitingIssues,
        },
        {
          title: 'Ready to resume',
          icon: <Play size={14} />,
          issues: continueIssues.slice(0, 1),
        },
      ]}
    />
  )
}
