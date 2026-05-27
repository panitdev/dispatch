import {
  FilePenLine,
  Folder,
  Home,
  PanelLeft,
  Settings,
} from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DispatchLogo } from '@/components/ui/logos'
import { getDisplayErrorMessage, listProjects } from '@/lib/api'

import { ProjectGlyph } from './primitives'

import type { DispatchPage } from '../../data/dispatch'
import type { ApiProject } from '@/lib/api'

export function Sidebar({ active, onToggle }: { active: DispatchPage; onToggle?: () => void }) {
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState<string | null>(null)
  const projectList = useMemo(() => flattenProjects(projects), [projects])
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const activeProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null
  const nav = [
    { label: 'Now' as const, to: '/', icon: Home },
    { label: 'Projects' as const, to: '/projects', icon: Folder },
    { label: 'Drafts' as const, to: '/drafts', icon: FilePenLine },
  ]

  useEffect(() => {
    const controller = new AbortController()

    setIsLoadingProjects(true)
    setProjectError(null)

    listProjects({ signal: controller.signal })
      .then((nextProjects) => {
        setProjects(nextProjects)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setProjectError(
          getDisplayErrorMessage(error, 'Failed to load projects.'),
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingProjects(false)
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <aside className="flex h-full min-h-0 w-full flex-col md:border-r md:w-[232px] border-[var(--dispatch-border-soft)] bg-[var(--dispatch-bg-surface)] px-2.5 pt-3.5 pb-3">
      <div className="mb-2.5 hidden md:flex items-center gap-2.5 rounded-[var(--dispatch-r-lg)] bg-[linear-gradient(90deg,var(--dispatch-brand-grad-start)_0%,var(--dispatch-brand-grad-mid)_34%,var(--dispatch-brand-grad-end)_100%)] px-2.5 py-2.5">
        <SidebarLogo />
        <div className="text-[17px] font-semibold tracking-[-0.015em]">
          Dispatch
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={onToggle}
        >
          <PanelLeft size={16} />
        </Button>
      </div>

      <nav className="flex flex-col gap-px">
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              to={item.to}
              className={navItemClass(active === item.label)}
            >
              <Icon size={16} className="shrink-0 opacity-85" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-[var(--dispatch-text-quaternary)] uppercase">
        Projects
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-1">
        {isLoadingProjects ? (
          <SidebarProjectState>Loading projects...</SidebarProjectState>
        ) : projectError ? (
          <SidebarProjectState>{projectError}</SidebarProjectState>
        ) : projectList.length === 0 ? (
          <SidebarProjectState>No projects yet.</SidebarProjectState>
        ) : (
          projectList.map(({ project, depth }) => (
            <SidebarProject
              key={project.id}
              project={project}
              depth={depth}
              active={project.id === activeProjectId}
            />
          ))
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 border-t border-[var(--dispatch-border-soft)] pt-2">
        <Link
          to="/settings"
          className={`${navItemClass(active === 'Settings')} flex-1`}
        >
          <Settings size={16} className="shrink-0 opacity-85" />
          <span>Settings</span>
        </Link>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggle}
        >
          <PanelLeft size={14} />
        </Button>
      </div>
    </aside>
  )
}

function SidebarLogo() {
  return (
    <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[7px]">
      <DispatchLogo size={32} className="size-8" />
    </div>
  )
}

function SidebarProject({
  project,
  depth,
  active,
}: {
  project: ApiProject
  depth: number
  active: boolean
}) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className={`${projectItemClass(active)} ${depth > 0 && !active ? 'text-[var(--dispatch-text-tertiary)]' : ''}`}
      style={{
        paddingLeft: `${10 + depth * 14}px`,
      }}
    >
      <ProjectGlyph
        letter={project.key.charAt(0)}
        projectKey={project.key}
        color={project.color}
        small
      />
      <span className="truncate">{project.name}</span>
      <span className="ml-auto truncate text-[11px] font-semibold text-[var(--dispatch-text-quaternary)] uppercase">
        {project.key}
      </span>
    </Link>
  )
}

function SidebarProjectState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1.5 text-[12px] leading-[1.45] text-[var(--dispatch-text-tertiary)]">
      {children}
    </div>
  )
}

function navItemClass(active: boolean) {
  const base =
    'flex cursor-pointer items-center gap-2.5 rounded-[var(--dispatch-r-md)] px-2.5 py-[7px] text-[13.5px] font-medium no-underline transition-colors'

  if (active) {
    return `${base} bg-[linear-gradient(180deg,var(--dispatch-cobalt-18)_0%,var(--dispatch-cobalt-12)_100%)] text-[var(--dispatch-text-primary)] shadow-[0_0_0_1px_var(--dispatch-cobalt-30)_inset,0_1px_0_oklch(0.85_0.1_264_/_0.18)_inset] [&_svg]:text-[var(--dispatch-cobalt-bright)] [&_svg]:opacity-100`
  }

  return `${base} text-[var(--dispatch-text-secondary)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]`
}

function projectItemClass(active: boolean) {
  const base =
    'flex cursor-pointer items-center gap-2.5 rounded-[var(--dispatch-r-md)] py-1.5 pr-2.5 text-[13px] font-medium no-underline transition-colors'

  if (active) {
    return `${base} bg-[var(--dispatch-bg-hover)] text-[var(--dispatch-text-primary)] shadow-[0_0_0_1px_var(--dispatch-border)_inset]`
  }

  return `${base} text-[var(--dispatch-text-secondary)] hover:bg-[var(--dispatch-bg-hover)] hover:text-[var(--dispatch-text-primary)]`
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
