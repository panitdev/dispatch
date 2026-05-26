import { BarChart2, Pencil, Tag, Trash2 } from 'lucide-react'

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

const STATUSES = ['Doing', 'Next', 'Draft', 'Done', 'Cancelled']
const PRIORITIES = ['No priority', 'Urgent', 'High', 'Medium', 'Low']
const PLACEHOLDER_LABELS = ['Feature', 'Bug', 'Refactor']

const ITEM_CLS = 'py-1.5 text-[13px]'
const SUB_TRIGGER_CLS = 'py-1.5 text-[13px]'

export type IssueMenuProps = {
  status: string
  labels: string[]
  onStatusChange: (status: string) => void
  onLabelsChange: (labels: string[]) => void
  onRename: () => void
  onDelete: () => void
}

export function IssueContextMenuItems({
  status,
  labels,
  onStatusChange,
  onLabelsChange,
  onRename,
  onDelete,
}: IssueMenuProps) {
  const normalized = status.toLowerCase()

  function toggleLabel(label: string) {
    if (labels.includes(label)) {
      onLabelsChange(labels.filter((l) => l !== label))
    } else {
      onLabelsChange([...labels, label])
    }
  }

  return (
    <>
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
                {value === normalized && (
                  <span className="ml-auto text-[var(--dispatch-cobalt-bright)]">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <polyline points="2,6 5,9.5 10,2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
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
            <ContextMenuItem key={p} className={ITEM_CLS}>{p}</ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <Tag size={14} className="shrink-0" />
          Labels
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className="min-w-[140px]">
          {PLACEHOLDER_LABELS.map((label) => (
            <ContextMenuCheckboxItem
              key={label}
              checked={labels.includes(label)}
              onCheckedChange={() => toggleLabel(label)}
              className={ITEM_CLS}
            >
              {label}
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
  status,
  labels,
  onStatusChange,
  onLabelsChange,
  onRename,
  onDelete,
}: IssueMenuProps) {
  const normalized = status.toLowerCase()

  function toggleLabel(label: string) {
    if (labels.includes(label)) {
      onLabelsChange(labels.filter((l) => l !== label))
    } else {
      onLabelsChange([...labels, label])
    }
  }

  return (
    <>
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
                {value === normalized && (
                  <span className="ml-auto text-[var(--dispatch-cobalt-bright)]">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <polyline points="2,6 5,9.5 10,2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
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
            <DropdownMenuItem key={p} className={ITEM_CLS}>{p}</DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={SUB_TRIGGER_CLS}>
          <Tag size={14} className="shrink-0" />
          Labels
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-[140px]">
          {PLACEHOLDER_LABELS.map((label) => (
            <DropdownMenuCheckboxItem
              key={label}
              checked={labels.includes(label)}
              onCheckedChange={() => toggleLabel(label)}
              className={ITEM_CLS}
            >
              {label}
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
