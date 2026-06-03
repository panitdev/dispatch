import { useEffect, useState } from 'react'
import { BarChart2, Download, ExternalLink, Pencil, Tag, Trash2 } from 'lucide-react'

import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

import { StatusCircle } from './primitives'
import { listProjectLabels } from '@/lib/api'

const STATUSES = ['Doing', 'Next', 'Draft', 'Done', 'Cancelled']

const PRIORITIES: { label: string; value: number }[] = [
  { label: 'No priority', value: 0 },
  { label: 'Urgent', value: 1 },
  { label: 'High', value: 2 },
  { label: 'Medium', value: 3 },
  { label: 'Low', value: 4 },
]

const ITEM_CLS = 'py-1.5 text-[13px]'
const SUB_TRIGGER_CLS = 'py-1.5 text-[13px]'

function Checkmark() {
  return (
    <span className="ml-auto text-[var(--dispatch-cobalt-bright)]">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <polyline points="2,6 5,9.5 10,2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type IssueMenuProps = {
  projectId?: string
  status: string
  priority: number
  labels: string[]
  onStatusChange: (status: string) => void
  onPriorityChange: (priority: number) => void
  onLabelsChange: (labels: string[]) => void
  onRename: () => void
  onDelete: () => void
  onOpen?: () => void
  onExportMarkdown?: () => void
}

function useProjectLabelOptions(projectId: string | undefined, selectedLabels: string[]) {
  const [projectLabels, setProjectLabels] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    if (!projectId) {
      setProjectLabels([])
      return () => {
        cancelled = true
      }
    }

    listProjectLabels(projectId)
      .then((rows) => {
        if (!cancelled) setProjectLabels(rows.map((label) => label.name))
      })
      .catch(() => {
        if (!cancelled) setProjectLabels([])
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  return [
    ...projectLabels,
    ...selectedLabels.filter((label) => !projectLabels.includes(label)),
  ]
}

export function IssueContextMenuItems({
  projectId,
  status,
  priority,
  labels,
  onStatusChange,
  onPriorityChange,
  onLabelsChange,
  onRename,
  onDelete,
  onOpen,
  onExportMarkdown,
}: IssueMenuProps) {
  const normalized = status.toLowerCase()
  const labelOptions = useProjectLabelOptions(projectId, labels)

  function toggleLabel(label: string) {
    if (labels.includes(label)) {
      onLabelsChange(labels.filter((l) => l !== label))
    } else {
      onLabelsChange([...labels, label])
    }
  }

  return (
    <>
      {(onOpen || onExportMarkdown) && (
        <>
          {onOpen && (
            <ContextMenuItem onSelect={onOpen} className={ITEM_CLS}>
              <ExternalLink size={14} className="shrink-0" />
              Open
            </ContextMenuItem>
          )}
          {onExportMarkdown && (
            <ContextMenuItem onSelect={onExportMarkdown} className={ITEM_CLS}>
              <Download size={14} className="shrink-0" />
              Export as Markdown
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <StatusCircle status={normalized} className="size-[14px] shrink-0" />
          Status
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="min-w-[160px]">
          {STATUSES.map((s) => {
            const value = s.toLowerCase()
            return (
              <ContextMenuItem
                key={s}
                onSelect={() => onStatusChange(value)}
                className={`${ITEM_CLS} gap-2`}
              >
                <StatusCircle status={value} className="size-[14px] shrink-0" />
                {s}
                {value === normalized && <Checkmark />}
              </ContextMenuItem>
            )
          })}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <BarChart2 size={14} className="shrink-0" />
          Priority
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="min-w-[140px]">
          {PRIORITIES.map((p) => (
            <ContextMenuItem
              key={p.label}
              onSelect={() => onPriorityChange(p.value)}
              className={`${ITEM_CLS} gap-2`}
            >
              {p.label}
              {p.value === priority && <Checkmark />}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <Tag size={14} className="shrink-0" />
          Labels
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="min-w-[140px]">
          {labelOptions.map((label) => (
            <ContextMenuCheckboxItem
              key={label}
              checked={labels.includes(label)}
              onCheckedChange={() => toggleLabel(label)}
              className={ITEM_CLS}
            >
              {capitalize(label)}
            </ContextMenuCheckboxItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      <ContextMenuItem onSelect={onRename} className={ITEM_CLS}>
        <Pencil size={14} className="shrink-0" />
        Rename
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem variant="destructive" onSelect={onDelete} className={ITEM_CLS}>
        <Trash2 size={14} className="shrink-0" />
        Delete
      </ContextMenuItem>
    </>
  )
}

export function IssueDropdownMenuItems({
  projectId,
  status,
  priority,
  labels,
  onStatusChange,
  onPriorityChange,
  onLabelsChange,
  onRename,
  onDelete,
  onOpen,
  onExportMarkdown,
}: IssueMenuProps) {
  const normalized = status.toLowerCase()
  const labelOptions = useProjectLabelOptions(projectId, labels)

  function toggleLabel(label: string) {
    if (labels.includes(label)) {
      onLabelsChange(labels.filter((l) => l !== label))
    } else {
      onLabelsChange([...labels, label])
    }
  }

  return (
    <>
      {(onOpen || onExportMarkdown) && (
        <>
          {onOpen && (
            <DropdownMenuItem onSelect={onOpen} className={ITEM_CLS}>
              <ExternalLink size={14} className="shrink-0" />
              Open
            </DropdownMenuItem>
          )}
          {onExportMarkdown && (
            <DropdownMenuItem onSelect={onExportMarkdown} className={ITEM_CLS}>
              <Download size={14} className="shrink-0" />
              Export as Markdown
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <StatusCircle status={normalized} className="size-[14px] shrink-0" />
          Status
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[160px]">
          {STATUSES.map((s) => {
            const value = s.toLowerCase()
            return (
              <DropdownMenuItem
                key={s}
                onSelect={() => onStatusChange(value)}
                className={`${ITEM_CLS} gap-2`}
              >
                <StatusCircle status={value} className="size-[14px] shrink-0" />
                {s}
                {value === normalized && <Checkmark />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <BarChart2 size={14} className="shrink-0" />
          Priority
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[140px]">
          {PRIORITIES.map((p) => (
            <DropdownMenuItem
              key={p.label}
              onSelect={() => onPriorityChange(p.value)}
              className={`${ITEM_CLS} gap-2`}
            >
              {p.label}
              {p.value === priority && <Checkmark />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <Tag size={14} className="shrink-0" />
          Labels
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[140px]">
          {labelOptions.map((label) => (
            <DropdownMenuCheckboxItem
              key={label}
              checked={labels.includes(label)}
              onCheckedChange={() => toggleLabel(label)}
              className={ITEM_CLS}
            >
              {capitalize(label)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator />

      <DropdownMenuItem onSelect={onRename} className={ITEM_CLS}>
        <Pencil size={14} className="shrink-0" />
        Rename
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem variant="destructive" onSelect={onDelete} className={ITEM_CLS}>
        <Trash2 size={14} className="shrink-0" />
        Delete
      </DropdownMenuItem>
    </>
  )
}
