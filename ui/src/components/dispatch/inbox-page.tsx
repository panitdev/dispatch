import { Calendar, Inbox } from 'lucide-react'

import { WorkListPage } from './work-list-page'
import { dueIssues, inboxIssues, pageCopy } from '../../data/dispatch'

export function InboxPage() {
  return (
    <WorkListPage
      title={pageCopy.Inbox.title}
      subtitle={pageCopy.Inbox.subtitle}
      sections={[
        {
          title: 'Needs triage',
          icon: <Inbox size={14} />,
          issues: inboxIssues,
        },
        {
          title: 'Suggested next',
          tone: 'amber',
          icon: <Calendar size={14} />,
          issues: dueIssues,
        },
      ]}
    />
  )
}
