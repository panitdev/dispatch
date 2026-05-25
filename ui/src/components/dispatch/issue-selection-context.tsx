import {
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react'

import type React from 'react'

type IssueSelectionContextValue = {
  selectedIssueId: string | null
  selectIssue: (issueId: string) => void
  closeIssue: () => void
}

const IssueSelectionContext =
  createContext<IssueSelectionContextValue | null>(null)

export function IssueSelectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

  const value = useMemo(
    () => ({
      selectedIssueId,
      selectIssue: setSelectedIssueId,
      closeIssue: () => setSelectedIssueId(null),
    }),
    [selectedIssueId],
  )

  return (
    <IssueSelectionContext.Provider value={value}>
      {children}
    </IssueSelectionContext.Provider>
  )
}

export function useIssueSelection() {
  const context = useContext(IssueSelectionContext)

  if (!context) {
    throw new Error(
      'useIssueSelection must be used within IssueSelectionProvider',
    )
  }

  return context
}
