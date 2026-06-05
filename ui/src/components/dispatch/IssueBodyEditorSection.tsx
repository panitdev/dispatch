import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getDisplayErrorMessage, updateIssue } from '@/lib/api'
import { toast } from 'sonner'

import { IssueEditor } from './IssueEditor'

import { cn } from '@/lib/utils'

import type { ApiIssue } from '@/lib/api'
import type { IssueBodyBlock } from './IssueEditor'

function comparableBlocks(blocks: IssueBodyBlock[]) {
  return blocks.map(({ kind, title, content, metadata }) => ({
    kind,
    title: title ?? null,
    content,
    metadata: metadata ?? null,
  }))
}

function blocksMatch(a: IssueBodyBlock[], b: IssueBodyBlock[]) {
  return (
    JSON.stringify(comparableBlocks(a)) === JSON.stringify(comparableBlocks(b))
  )
}

interface IssueBodyEditorSectionProps {
  issue: ApiIssue
  onIssueChange: (issue: ApiIssue) => void
  className?: string
  placeholder?: string
}

export function IssueBodyEditorSection({
  issue,
  onIssueChange,
  className,
  placeholder = 'Write a description...',
}: IssueBodyEditorSectionProps) {
  const [bodyDraft, setBodyDraft] = useState<IssueBodyBlock[]>(
    issue.blocks as IssueBodyBlock[],
  )
  const [savingBody, setSavingBody] = useState(false)
  const [editorVersion, setEditorVersion] = useState(0)
  const previousIssueId = useRef(issue.id)

  useEffect(() => {
    if (previousIssueId.current === issue.id) {
      return
    }

    previousIssueId.current = issue.id
    setBodyDraft(issue.blocks as IssueBodyBlock[])
    setSavingBody(false)
    setEditorVersion((version) => version + 1)
  }, [issue.id, issue.blocks])

  const bodyBlocks = issue.blocks as IssueBodyBlock[]
  const dirty = !blocksMatch(bodyDraft, bodyBlocks)

  async function commitBody() {
    if (!dirty) {
      return
    }

    setSavingBody(true)
    try {
      const updated = await updateIssue(issue.id, { blocks: bodyDraft })
      onIssueChange(updated)
      setBodyDraft(updated.blocks as IssueBodyBlock[])
      setEditorVersion((version) => version + 1)
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to save body.'))
    } finally {
      setSavingBody(false)
    }
  }

  function cancelBody() {
    setBodyDraft(bodyBlocks)
    setEditorVersion((version) => version + 1)
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <IssueEditor
        key={`${issue.id}-${editorVersion}`}
        initialBlocks={bodyDraft}
        placeholder={placeholder}
        onChange={setBodyDraft}
      />
      {dirty || savingBody ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => void commitBody()}
            loading={savingBody}
            loadingText="Saving…"
            className="rounded-[var(--dispatch-r-lg)] border-transparent bg-[var(--dispatch-cobalt)] text-white shadow-[var(--dispatch-shadow-cta)] hover:bg-[var(--dispatch-cobalt)]/90"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelBody}
            disabled={savingBody}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  )
}
