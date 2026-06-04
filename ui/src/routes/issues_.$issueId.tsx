import { Await, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

import {
  IssuePage,
  IssuePageError,
  IssuePageSkeleton,
} from '../features/issues/issue-page'
import { getIssuePageData } from '../lib/page-data'

export const Route = createFileRoute('/issues_/$issueId')({
  loader: ({ params }) => ({
    dataPromise: getIssuePageData({ issueId: params.issueId }),
  }),
  component: IssuePageRoute,
  errorComponent: IssuePageRouteError,
})

function IssuePageRoute() {
  const { dataPromise } = Route.useLoaderData()

  return (
    <Await promise={dataPromise} fallback={<IssuePageSkeleton />}>
      {(data) => <IssuePage data={data} />}
    </Await>
  )
}

function IssuePageRouteError({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error ? error.message : 'Could not load this issue.'
  return <IssuePageError message={message} />
}
