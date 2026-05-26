import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { AnimatedField } from '#/components/ui/animated-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

import { createProject, getDisplayErrorMessage, listProjects } from '#/lib/api'
import { toast } from 'sonner'

import type { ApiProject } from '#/lib/api'
import type { FormEvent } from 'react'

interface ProjectCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

function validateProjectKey(value: string) {
  if (!value.trim()) return 'Project key is required.'
  if (!/^[A-Z0-9]+$/.test(value)) return 'Use only uppercase letters and numbers.'
  return null
}

function validateProjectName(value: string) {
  if (!value.trim()) return 'Project name is required.'
  return null
}

function flattenProjects(
  projects: ApiProject[],
  depth = 0,
): Array<{ project: ApiProject; depth: number }> {
  return projects.flatMap((project) => [
    { project, depth },
    ...flattenProjects(project.sub_projects, depth + 1),
  ])
}

const NO_PARENT_PROJECT = '__none__'

export function ProjectCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: ProjectCreateDialogProps) {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [color, setColor] = useState('#5b5bd6')
  const [parentId, setParentId] = useState('')

  useEffect(() => {
    if (!open) return
    listProjects()
      .then(setProjects)
      .catch(() => {})
  }, [open])

  const projectList = flattenProjects(projects)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      await createProject({
        name,
        key: keyValue,
        color,
        parent_id: parentId || undefined,
      })
      setName('')
      setKeyValue('')
      setColor('#5b5bd6')
      setParentId('')
      onCreated?.()
      onOpenChange(false)
      toast.success('Project created')
    } catch (createError) {
      setError(getDisplayErrorMessage(createError, 'Failed to create project.'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Add a project to the dispatch workspace. Issue creation stays out
            of scope here.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="rounded-[var(--dispatch-r-md)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] px-3 py-2 text-[13px] text-[var(--dispatch-amber)]">
            {error}
          </div>
        ) : null}
        <form
          className="space-y-4 [&_[class*='bg-card']]:bg-[var(--dispatch-bg-surface)] [&_[class*='border-border']]:border-[var(--dispatch-border)] [&_[class*='border-primary']]:border-[var(--dispatch-cobalt-30)] [&_[class*='ring-primary']]:ring-[var(--dispatch-cobalt-30)]/20 [&_input]:text-[var(--dispatch-text-primary)] [&_label]:text-[var(--dispatch-text-secondary)]"
          onSubmit={handleSubmit}
        >
          <AnimatedField
            id="project-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Registry"
            validate={validateProjectName}
            required
          />
          <AnimatedField
            id="project-key"
            label="Key"
            value={keyValue}
            onChange={(value) => setKeyValue(value.toUpperCase())}
            placeholder="REG"
            validate={validateProjectKey}
            required
          />
          <AnimatedField
            id="project-color"
            label="Color"
            type="color"
            value={color}
            onChange={setColor}
          />
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[var(--dispatch-text-secondary)]">
              Parent project
            </span>
            <Select
              value={parentId || NO_PARENT_PROJECT}
              onValueChange={(value) =>
                setParentId(value === NO_PARENT_PROJECT ? '' : value)
              }
            >
              <SelectTrigger className="h-11 w-full rounded-lg border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)] px-3 text-[var(--dispatch-text-primary)] data-[placeholder]:text-[var(--dispatch-text-tertiary)] [&_svg]:text-[var(--dispatch-text-tertiary)]">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="dispatch-theme border-[var(--dispatch-border-strong)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)]">
                <SelectItem
                  value={NO_PARENT_PROJECT}
                  className="text-[var(--dispatch-text-primary)] focus:bg-[var(--dispatch-bg-hover)] focus:text-[var(--dispatch-text-primary)]"
                >
                  None
                </SelectItem>
                {projectList.map(({ project, depth }) => (
                  <SelectItem
                    key={project.id}
                    value={project.id}
                    className="text-[var(--dispatch-text-primary)] focus:bg-[var(--dispatch-bg-hover)] focus:text-[var(--dispatch-text-primary)]"
                  >
                    {`${'  '.repeat(depth)}${project.key} · ${project.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-surface)]">
            <Button
              variant="outline"
              type="button"
              className="border-[var(--dispatch-border)] bg-[var(--dispatch-bg-elevated)] text-[var(--dispatch-text-primary)] hover:border-[var(--dispatch-border-strong)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isCreating} loadingText="Creating">
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
