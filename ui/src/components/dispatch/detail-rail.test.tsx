import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DetailRail } from './detail-rail'
import {
  IssueSelectionProvider,
  useIssueSelection,
} from './issue-selection-context'

import type { ApiIssue, ApiProject } from '@/lib/api'

const { getIssueMock, getProjectMock } = vi.hoisted(() => ({
  getIssueMock: vi.fn(),
  getProjectMock: vi.fn(),
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')

  return {
    ...actual,
    getIssue: getIssueMock,
    getProject: getProjectMock,
  }
})

vi.mock('@/components/dispatch/IssueBodyEditorSection', () => ({
  IssueBodyEditorSection: () => <div data-testid="issue-body-editor" />,
}))

vi.mock('@/lib/issue-markdown-export', () => ({
  exportIssueMarkdown: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

const issue: ApiIssue = {
  id: 'issue_123',
  key: 'DIS-19',
  project_id: 'project_123',
  parent_id: null,
  title: 'Broken scrolling of issue drawer on mobile',
  status: 'doing',
  priority: 2,
  labels: ['mobile'],
  assignee_id: null,
  blocks: [],
  created_at: '2026-06-06T06:06:41.677218+00:00',
  updated_at: '2026-06-06T06:06:41.677218+00:00',
  blocked_by: [],
  related_to: [],
}

const project: ApiProject = {
  id: 'project_123',
  key: 'DIS',
  name: 'Dispatch',
  color: '#3366ff',
  parent_id: null,
  sub_projects: [],
  created_at: '2026-06-06T06:06:41.677218+00:00',
  updated_at: '2026-06-06T06:06:41.677218+00:00',
}

function SelectIssue({ issueId }: { issueId: string }) {
  const { selectIssue } = useIssueSelection()

  useEffect(() => {
    selectIssue(issueId)
  }, [issueId, selectIssue])

  return null
}

describe('DetailRail', () => {
  beforeEach(() => {
    getIssueMock.mockResolvedValue(issue)
    getProjectMock.mockResolvedValue(project)
  })

  it('keeps the rail and body shrinkable for drawer scrolling', async () => {
    const { container } = render(
      <IssueSelectionProvider>
        <SelectIssue issueId={issue.id} />
        <DetailRail className="h-auto min-h-0 w-full flex-1 border-l-0" />
      </IssueSelectionProvider>,
    )

    await screen.findByText(issue.title)

    const rail = container.querySelector('aside')
    const scrollBody = container.querySelector('.overflow-y-auto')

    expect(rail?.className).toContain('min-h-0')
    expect(scrollBody?.className).toContain('min-h-0')
    expect(scrollBody?.className).toContain('overflow-y-auto')
  })
})
