import { Calendar, History, Play } from 'lucide-react'

import { WorkListPage } from './work-list-page'
import {
  continueIssues,
  dueIssues,
  pageCopy,
  recentIssues,
} from '../../data/dispatch'

export function NowPage() {
  return (
    <WorkListPage
      title={pageCopy.Now.title}
      subtitle={pageCopy.Now.subtitle}
      sections={[
        { title: 'Continue', icon: <Play size={14} />, issues: continueIssues },
        {
          title: 'Due / Revisit',
          tone: 'amber',
          icon: <Calendar size={14} />,
          issues: dueIssues,
        },
        {
          title: 'Recently touched',
          tone: 'muted',
          icon: <History size={14} />,
          issues: recentIssues,
        },
      ]}
    />
  )
}
