import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Share2,
  SlidersHorizontal,
  Filter,
  MoreHorizontal,
  Star,
  Trash2,
  Plus,
  Pencil,
} from 'lucide-react'
import { StatusCircle } from '../../components/dispatch/primitives'
import { useRouter } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedField } from '@/components/ui/animated-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CompactIssueRow } from '../../components/dispatch/compact-issue-row'
import { useIssueSelection } from '../../components/dispatch/issue-selection-context'

import {
  updateProject,
  deleteProject,
  listProjectLabels,
  createProjectLabel,
  updateProjectLabel,
  deleteProjectLabel,
  getDisplayErrorMessage,
} from '@/lib/api'
import { toast } from 'sonner'

import type { ApiIssue, ApiIssueLabel, ApiProject } from '@/lib/api'
import type { ProjectPageData } from '@/lib/page-data'

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'backlog' | 'drafts'
type MainTab = 'issues' | 'settings'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterIssues(issues: ApiIssue[], filter: FilterTab): ApiIssue[] {
  switch (filter) {
    case 'active':
      return issues.filter((i) =>
        ['doing', 'next'].includes(i.status.toLowerCase()),
      )
    case 'backlog':
      return issues.filter((i) =>
        ['todo', 'backlog'].includes(i.status.toLowerCase()),
      )
    case 'drafts':
      return issues.filter((i) => i.status.toLowerCase() === 'draft')
    default:
      return issues
  }
}

const STATUS_ORDER = [
  'doing',
  'next',
  'draft',
  'todo',
  'backlog',
  'done',
  'cancelled',
]

function getStatusDisplayName(status: string): string {
  const map: Record<string, string> = {
    doing: 'Doing',
    next: 'Next',
    draft: 'Draft',
    todo: 'To Do',
    backlog: 'Backlog',
    done: 'Done',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
}

function groupAndSortIssues(
  issues: ApiIssue[],
): Array<{ status: string; issues: ApiIssue[] }> {
  const sorted = [...issues].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const groups = new Map<string, ApiIssue[]>()
  for (const issue of sorted) {
    const status = issue.status.toLowerCase()
    if (!groups.has(status)) groups.set(status, [])
    groups.get(status)!.push(issue)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = STATUS_ORDER.indexOf(a)
      const bi = STATUS_ORDER.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    .map(([status, groupIssues]) => ({ status, issues: groupIssues }))
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  if (date.getFullYear() === now.getFullYear()) {
    return `${months[date.getMonth()]} ${date.getDate()}`
  }
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

const PAGE_SIZE = 25

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectPage({ data }: { data: ProjectPageData }) {
  const { project, issues } = data
  const { selectedIssueId, selectIssue } = useIssueSelection()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [mainTab, setMainTab] = useState<MainTab>('issues')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filterCounts: Record<FilterTab, number> = {
    all: issues.length,
    active: filterIssues(issues, 'active').length,
    backlog: filterIssues(issues, 'backlog').length,
    drafts: filterIssues(issues, 'drafts').length,
  }

  const filteredIssues = filterIssues(issues, activeFilter)
  const allGroups = groupAndSortIssues(filteredIssues)

  // Accumulate complete groups until visibleCount is reached
  let accumulated = 0
  const visibleGroups: typeof allGroups = []
  for (const group of allGroups) {
    if (accumulated >= visibleCount) break
    visibleGroups.push(group)
    accumulated += group.issues.length
  }
  const hasMore = visibleGroups.length < allGroups.length

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [activeFilter])

  // Stable refs so the IntersectionObserver callback never needs to be recreated
  const hasMoreRef = useRef(hasMore)
  hasMoreRef.current = hasMore
  const filteredLengthRef = useRef(filteredIssues.length)
  filteredLengthRef.current = filteredIssues.length

  // Infinite scroll via IntersectionObserver
  const handleSentinel = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting && hasMoreRef.current) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredLengthRef.current))
    }
  }, [])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(handleSentinel, {
      threshold: 0.1,
    })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [handleSentinel])

  return (
    <div className="-mx-[18px] md:-mx-10 -mt-[22px] md:-mt-7">
      {/* ── Project header (scrolls away) ────────────────────────────────── */}
      <div className="flex items-start justify-between px-[18px] md:px-10 pt-[22px] md:pt-7 pb-5">
        <div className="flex items-start gap-4">
          <ProjectHeaderGlyph project={project} />
          <div className="pt-0.5">
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-[var(--dispatch-text-primary)]">
                {project.name}
              </h1>
              <button
                type="button"
                className="text-[var(--dispatch-text-quaternary)] hover:text-[var(--dispatch-amber)] transition-colors"
                aria-label="Star project"
              >
                <Star size={15} />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-[var(--dispatch-text-tertiary)]">
              <span className="font-mono text-[11.5px] font-medium tracking-[0.04em] text-[var(--dispatch-text-quaternary)] uppercase">
                {project.key}
              </span>
              <span className="h-3 w-px bg-[var(--dispatch-border-soft)]" />
              <span>Updated {formatDate(project.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-secondary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] hover:text-[var(--dispatch-text-primary)]"
          >
            <Share2 size={13} />
            Share
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>
      </div>

      {/* ── Issues / Settings tabs ────────────────────────────────────────── */}
      <div className="flex items-end gap-0 border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10">
        <TabItem
          active={mainTab === 'issues'}
          onClick={() => setMainTab('issues')}
        >
          Issues
        </TabItem>
        <TabItem
          active={mainTab === 'settings'}
          onClick={() => setMainTab('settings')}
        >
          Settings
        </TabItem>
      </div>

      {mainTab === 'settings' ? (
        <ProjectSettingsTab project={project} />
      ) : (
        <>
          {/* ── Sticky filter bar (always visible) ───────────────────────── */}
          <div className="sticky -top-[22px] z-10 flex items-center gap-1.5 border-b border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-base)] px-[18px] py-2.5 md:-top-7 md:px-10">
            <FilterTabItem
              active={activeFilter === 'all'}
              count={filterCounts.all}
              onClick={() => setActiveFilter('all')}
            >
              All issues
            </FilterTabItem>
            <FilterTabItem
              active={activeFilter === 'active'}
              count={filterCounts.active}
              onClick={() => setActiveFilter('active')}
            >
              Active
            </FilterTabItem>
            <FilterTabItem
              active={activeFilter === 'backlog'}
              count={filterCounts.backlog}
              onClick={() => setActiveFilter('backlog')}
            >
              Backlog
            </FilterTabItem>
            <FilterTabItem
              active={activeFilter === 'drafts'}
              count={filterCounts.drafts}
              onClick={() => setActiveFilter('drafts')}
            >
              Drafts
            </FilterTabItem>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
              >
                <Filter size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-primary)]"
              >
                <SlidersHorizontal size={14} />
              </Button>
            </div>
          </div>

          {/* ── Issue list ────────────────────────────────────────────────── */}
          <div>
            {filteredIssues.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-[var(--dispatch-text-tertiary)]">
                No issues in this filter.
              </div>
            ) : (
              <div>
                {visibleGroups.map((group) => (
                  <div key={group.status}>
                    {/* Sticky status group header */}
                    <div className="sticky top-[29px] z-[9] flex items-center gap-2 border-b border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-base)] px-[18px] py-[7px] md:top-[23px] md:px-10">
                      <StatusCircle status={group.status} />
                      <span className="text-[12.5px] font-semibold text-[var(--dispatch-text-secondary)]">
                        {getStatusDisplayName(group.status)}
                      </span>
                      <span className="ml-1 text-[11.5px] font-medium text-[var(--dispatch-text-quaternary)]">
                        {group.issues.length}
                      </span>
                    </div>
                    {group.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="border-b border-[var(--dispatch-border-soft)] last:border-b-0"
                      >
                        <CompactIssueRow
                          id={issue.id}
                          projectId={issue.project_id}
                          issueKey={issue.key}
                          status={issue.status}
                          priority={issue.priority}
                          title={issue.title}
                          labels={issue.labels}
                          date={issue.updated_at}
                          selected={issue.id === selectedIssueId}
                          onSelect={() => selectIssue(issue.id)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom sentinel for infinite scroll */}
            {hasMore ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center gap-2 py-6"
              >
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)] [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--dispatch-text-quaternary)] [animation-delay:300ms]" />
              </div>
            ) : filteredIssues.length > 0 ? (
              <div className="py-5 text-center text-[12px] text-[var(--dispatch-text-quaternary)]">
                {filteredIssues.length} issue
                {filteredIssues.length !== 1 ? 's' : ''}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function validateName(value: string) {
  if (!value.trim()) return 'Project name is required.'
  return null
}

function ProjectSettingsTab({ project }: { project: ApiProject }) {
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [color, setColor] = useState(project.color)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isDirty = name !== project.name || color !== project.color

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!isDirty) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateProject(project.id, { name: name.trim(), color })
      toast.success('Project settings saved')
      router.invalidate()
    } catch (err) {
      setSaveError(getDisplayErrorMessage(err, 'Failed to save settings.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-[18px] md:px-10 py-8 max-w-xl">
      {/* ── General section ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--dispatch-text-primary)]">
          General
        </h2>

        {saveError ? (
          <div className="mb-4 rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
            {saveError}
          </div>
        ) : null}

        <form
          className="space-y-4 [&_[class*='bg-card']]:bg-[var(--dispatch-bg-surface)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_[class*='border-primary']]:border-[var(--dispatch-cobalt-30)] [&_[class*='ring-primary']]:ring-[var(--dispatch-cobalt-30)]/20 [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]"
          onSubmit={handleSave}
        >
          <AnimatedField
            id="settings-project-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Project name"
            validate={validateName}
            required
          />

          {/* Project key — read only */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
              Key
            </label>
            <div className="flex h-11 items-center rounded-lg border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-hover)] px-3 font-mono text-[13px] font-medium tracking-[0.04em] text-[var(--dispatch-text-tertiary)] uppercase select-all">
              {project.key}
            </div>
            <p className="text-[11.5px] text-[var(--dispatch-text-quaternary)]">
              The project key cannot be changed after creation.
            </p>
          </div>

          <AnimatedField
            id="settings-project-color"
            label="Color"
            type="color"
            value={color}
            onChange={setColor}
          />

          <div className="pt-1">
            <Button
              type="submit"
              disabled={!isDirty}
              loading={isSaving}
              loadingText="Saving"
            >
              Save changes
            </Button>
          </div>
        </form>
      </section>

      {/* ── Labels ──────────────────────────────────────────────────────── */}
      <LabelsSection projectId={project.id} />

      {/* ── Danger zone ─────────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="mb-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--dispatch-text-primary)]">
          Danger zone
        </h2>
        <p className="mb-5 text-[13px] text-[var(--dispatch-text-tertiary)]">
          Irreversible actions. Proceed with caution.
        </p>

        <div className="rounded-[var(--dispatch-r-lg)] border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-medium text-[var(--dispatch-text-primary)]">
                Delete this project
              </p>
              <p className="mt-0.5 text-[12.5px] text-[var(--dispatch-text-tertiary)]">
                Permanently delete{' '}
                <span className="font-medium text-[var(--dispatch-text-secondary)]">
                  {project.name}
                </span>{' '}
                and all its issues. This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={13} />
              Delete project
            </Button>
          </div>
        </div>
      </section>

      <ProjectDeleteDialog
        project={project}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  )
}

// ─── Labels section ───────────────────────────────────────────────────────────

const LABEL_COLORS = [
  '#E5534B',
  '#F78336',
  '#3FB950',
  '#2188FF',
  '#8957E5',
  '#DB61A2',
  '#39D0D3',
  '#8B949E',
]

function LabelsSection({ projectId }: { projectId: string }) {
  const [labels, setLabels] = useState<ApiIssueLabel[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState(LABEL_COLORS[0])
  const [isSavingLabel, setIsSavingLabel] = useState(false)
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null)

  useEffect(() => {
    listProjectLabels(projectId)
      .then((data) => setLabels(data))
      .catch(() => {})
  }, [projectId])

  function openAddForm() {
    setEditingId(null)
    setFormName('')
    setFormColor(LABEL_COLORS[0])
    setIsAdding(true)
  }

  function openEditForm(label: ApiIssueLabel) {
    setIsAdding(false)
    setEditingId(label.id)
    setFormName(label.name)
    setFormColor(
      LABEL_COLORS.includes(label.color) ? label.color : LABEL_COLORS[0],
    )
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingId(null)
    setFormName('')
    setFormColor(LABEL_COLORS[0])
  }

  async function handleSave() {
    const trimmed = formName.trim()
    if (!trimmed) return

    setIsSavingLabel(true)
    try {
      if (isAdding) {
        const created = await createProjectLabel(projectId, {
          name: trimmed,
          color: formColor,
        })
        setLabels((prev) => [...prev, created])
        setIsAdding(false)
      } else if (editingId) {
        const updated = await updateProjectLabel(projectId, editingId, {
          name: trimmed,
          color: formColor,
        })
        setLabels((prev) =>
          prev.map((label) => (label.id === editingId ? updated : label)),
        )
        setEditingId(null)
      }
      setFormName('')
      setFormColor(LABEL_COLORS[0])
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to save label.'))
    } finally {
      setIsSavingLabel(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingLabelId(id)
    try {
      await deleteProjectLabel(projectId, id)
      setLabels((prev) => prev.filter((label) => label.id !== id))
      if (editingId === id) cancelForm()
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, 'Failed to delete label.'))
    } finally {
      setDeletingLabelId(null)
    }
  }

  const showForm = isAdding || editingId !== null

  return (
    <section className="mt-10">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--dispatch-text-primary)]">
          Labels
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-secondary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-elevated)] hover:text-[var(--dispatch-text-primary)]"
          onClick={openAddForm}
        >
          <Plus size={12} />
          New label
        </Button>
      </div>
      <p className="mb-4 text-[13px] text-[var(--dispatch-text-tertiary)]">
        Manage labels used across this project's issues.
      </p>

      <div className="overflow-hidden rounded-[var(--dispatch-r-lg)] border border-[var(--dispatch-border-soft)]">
        {showForm && (
          <div className="space-y-3 border-b border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-4 py-3.5">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSave()
                  }
                  if (e.key === 'Escape') cancelForm()
                }}
                placeholder="feature"
                autoFocus
                className="w-full rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] px-3 py-2 text-[13px] text-[var(--dispatch-text-primary)] placeholder:text-[var(--dispatch-text-quaternary)] outline-none focus:border-[var(--dispatch-cobalt)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
                Color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`h-7 w-7 shrink-0 rounded-full transition-transform hover:scale-110 ${formColor === color ? 'scale-110 ring-2 ring-[var(--dispatch-cobalt)] ring-offset-2 ring-offset-[var(--dispatch-bg-surface)]' : ''}`}
                    style={{ background: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!formName.trim()}
                loading={isSavingLabel}
                loadingText="Saving"
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelForm}
                className="text-[var(--dispatch-text-secondary)] hover:text-[var(--dispatch-text-primary)]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[280px] overflow-y-auto">
          {labels.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--dispatch-text-quaternary)]">
              No labels yet.
            </div>
          ) : (
            labels.map((label) => (
              <div
                key={label.id}
                className="group flex items-center gap-3 border-b border-[var(--dispatch-border-soft)] px-4 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--dispatch-bg-hover)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: label.color }}
                />
                <span className="flex-1 text-[13px] font-medium text-[var(--dispatch-text-primary)]">
                  {label.name}
                </span>
                <span
                  className="inline-flex items-center rounded-[4px] border px-[6px] py-[2px] text-[11px] font-medium leading-[1.4]"
                  style={{
                    background: `color-mix(in oklab, ${label.color} 12%, transparent)`,
                    borderColor: `color-mix(in oklab, ${label.color} 30%, transparent)`,
                    color: label.color,
                  }}
                >
                  {label.name}
                </span>
                <button
                  type="button"
                  onClick={() => openEditForm(label)}
                  className="text-[var(--dispatch-text-quaternary)] transition-colors hover:text-[var(--dispatch-text-secondary)]"
                  aria-label="Edit label"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(label.id)}
                  disabled={deletingLabelId === label.id}
                  className="text-[var(--dispatch-text-quaternary)] transition-colors hover:text-[var(--dispatch-rust)] disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Delete label"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function ProjectDeleteDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ApiProject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirmName.trim() === project.name

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmName('')
      setError(null)
    }
  }, [open])

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!canDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteProject(project.id)
      toast.success(`"${project.name}" has been deleted`)
      onOpenChange(false)
      router.navigate({ to: '/projects' })
    } catch (err) {
      setError(getDisplayErrorMessage(err, 'Failed to delete project.'))
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This will permanently delete{' '}
            <strong className="text-[var(--dispatch-text-primary)]">
              {project.name}
            </strong>{' '}
            and all of its issues. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
            {error}
          </div>
        ) : null}

        <form
          className="space-y-4 [&_[class*='bg-card']]:bg-[var(--dispatch-bg-surface)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_[class*='border-primary']]:border-[var(--dispatch-cobalt-30)] [&_[class*='ring-primary']]:ring-[var(--dispatch-cobalt-30)]/20 [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]"
          onSubmit={handleDelete}
        >
          <div className="space-y-1.5">
            <p className="text-[12.5px] text-[var(--dispatch-text-secondary)]">
              Type{' '}
              <span className="font-semibold text-[var(--dispatch-text-primary)]">
                {project.name}
              </span>{' '}
              to confirm.
            </p>
            <AnimatedField
              id="delete-confirm-name"
              label="Project name"
              value={confirmName}
              onChange={setConfirmName}
              placeholder={project.name}
            />
          </div>

          <DialogFooter className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)]">
            <Button
              variant="outline"
              type="button"
              className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canDelete}
              loading={isDeleting}
              loadingText="Deleting"
            >
              Delete project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectHeaderGlyph({ project }: { project: ApiProject }) {
  const color = project.color
  return (
    <span
      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[12px] text-[22px] font-bold tracking-[-0.02em] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_2px_8px_rgba(0,0,0,0.35)]"
      style={{
        background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black))`,
      }}
    >
      {project.key.charAt(0)}
    </span>
  )
}

function TabItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative cursor-pointer px-1 pb-2.5 pt-1 text-[13.5px] font-medium transition-colors mr-5 ${
        active
          ? 'text-[var(--dispatch-text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:bg-[var(--dispatch-cobalt-bright)]'
          : 'text-[var(--dispatch-text-tertiary)] hover:text-[var(--dispatch-text-secondary)]'
      }`}
    >
      {children}
    </button>
  )
}

function FilterTabItem({
  children,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-[var(--dispatch-r-md)] px-3 py-[5px] text-[13px] font-medium transition-colors ${
        active
          ? 'bg-[var(--dispatch-bg-surface)] text-[var(--dispatch-text-primary)] shadow-[0_0_0_1px_var(--dispatch-border-soft)_inset]'
          : 'text-[var(--dispatch-text-tertiary)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-secondary)]'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-[6px] py-px text-[11px] font-semibold leading-[1.4] tabular-nums ${
          active
            ? 'bg-[var(--dispatch-cobalt-12)] text-[var(--dispatch-cobalt-bright)]'
            : 'bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-quaternary)]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ProjectPageSkeleton() {
  return (
    <div className="-mx-[18px] md:-mx-10 -mt-[22px] md:-mt-7">
      {/* Header — pt-[22px] md:pt-7 pb-5 */}
      <div className="flex items-start justify-between px-[18px] md:px-10 pt-[22px] md:pt-7 pb-5">
        <div className="flex items-start gap-4">
          <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-[12px] bg-[var(--dispatch-bg-hover)]" />
          <div className="pt-0.5">
            {/* h1 renders at line-height:33px */}
            <Skeleton className="h-[33px] w-40 bg-[var(--dispatch-bg-hover)]" />
            {/* subtitle: mt-1.5 gap, rendered height ~19px */}
            <Skeleton className="mt-1.5 h-[19px] w-28 bg-[var(--dispatch-bg-hover)]" />
          </div>
        </div>
      </div>

      {/* Issues / Settings tabs — TabItem: pt-1 + ~20px text + pb-2.5 = 34px */}
      <div className="flex items-end gap-0 border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10">
        <div className="mr-5 pb-2.5 pt-1">
          <Skeleton className="h-5 w-14 bg-[var(--dispatch-bg-hover)]" />
        </div>
        <div className="pb-2.5 pt-1">
          <Skeleton className="h-5 w-16 bg-[var(--dispatch-bg-hover)]" />
        </div>
      </div>

      {/* Filter bar — py-2.5, filter buttons render at 31px */}
      <div className="flex items-center gap-1.5 border-b border-[var(--dispatch-border-soft)] px-[18px] md:px-10 py-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[31px] w-20 rounded-[var(--dispatch-r-md)] bg-[var(--dispatch-bg-hover)]"
          />
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="h-6 w-6 rounded-[var(--dispatch-r-sm)] bg-[var(--dispatch-bg-hover)]" />
          <Skeleton className="h-6 w-6 rounded-[var(--dispatch-r-sm)] bg-[var(--dispatch-bg-hover)]" />
        </div>
      </div>

      {/* Issue rows — px-6 py-[7px] gap-2; row height=46px driven by the h-8 action button */}
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-[var(--dispatch-border-soft)] px-6 py-[7px]"
          >
            <Skeleton className="h-2.5 w-3 shrink-0 bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 w-[72px] shrink-0 bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 flex-1 bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-full bg-[var(--dispatch-bg-hover)]" />
            <Skeleton className="h-3.5 w-[42px] shrink-0 bg-[var(--dispatch-bg-hover)]" />
            {/* invisible spacer matching the opacity-0 action button (h-8=32px) */}
            <div className="h-8 w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
