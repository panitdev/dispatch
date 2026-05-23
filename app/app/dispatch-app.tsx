"use client";

import { useEffect, useRef, useState } from "react";
import {
  createIssue as apiCreateIssue,
  listProjectIssues,
  updateIssue as apiUpdateIssue,
  type ApiIssue,
  type ApiProject,
  type ApiUser,
} from "@/lib/api/client";

type Status = "backlog" | "todo" | "in-progress" | "done" | "cancelled";
type Priority = "urgent" | "high" | "medium" | "low" | "none";
type Label = "bug" | "feature" | "improvement" | "docs";

type User = {
  id: string;
  name: string;
  initials: string;
  email: string;
};

type Project = {
  id: string;
  key: string;
  name: string;
  color: string;
  subProjects: Project[];
};

type Issue = {
  id: string;
  key: string;
  projectId: string;
  parentId: string | null;
  title: string;
  status: Status;
  priority: Priority;
  labels: Label[];
  assignee: string | null;
  body: string;
  createdAt: string;
  blockedBy: string[];
  relatedTo: string[];
};

type DocumentRecord = {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  body: string;
};

// ---- API → frontend type mappers ----

function mapApiUser(u: ApiUser): User {
  return { id: u.id, name: u.name, initials: u.initials, email: u.email };
}

function mapApiProject(p: ApiProject): Project {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    color: p.color,
    subProjects: p.sub_projects.map(mapApiProject),
  };
}

function mapApiIssue(i: ApiIssue): Issue {
  return {
    id: i.id,
    key: i.key,
    projectId: i.project_id,
    parentId: i.parent_id,
    title: i.title,
    status: i.status as Status,
    priority: i.priority as Priority,
    labels: i.labels as Label[],
    assignee: i.assignee_id,
    body: i.body,
    createdAt: i.created_at,
    blockedBy: i.blocked_by,
    relatedTo: i.related_to,
  };
}

const DOCUMENTS: DocumentRecord[] = [
  {
    id: "d1",
    projectId: "p1",
    title: "Architecture Overview",
    updatedAt: "2026-05-10",
    body: "# Architecture Overview\n\nDispatch is built as a lightweight, single-page application with a minimal backend.\n\n## Frontend\n\nReact with TypeScript for the UI layer. Minimal dependencies, fast load times.\n\n## Backend\n\nNode.js REST API with SQLite for data storage. Single binary distribution for easy self-hosting.\n\n## Deployment\n\nSingle binary that includes both the API server and serves the frontend assets. Deploy anywhere.",
  },
  {
    id: "d2",
    projectId: "p1",
    title: "Contributing Guide",
    updatedAt: "2026-05-08",
    body: "# Contributing to Dispatch\n\nWelcome! Here is how to get started contributing.\n\n## Prerequisites\n\n- Node.js 20+\n- pnpm\n\n## Getting Started\n\n- Fork the repository\n- Create a feature branch\n- Make your changes with tests\n- Submit a pull request\n\n## Code Style\n\nWe use ESLint and Prettier. Run pnpm lint before committing.",
  },
  {
    id: "d3",
    projectId: "p1",
    title: "Roadmap",
    updatedAt: "2026-05-15",
    body: "# Roadmap\n\n## v0.1, Foundation\n\n- Core issue tracking\n- Project management\n- Document support\n\n## v0.2, Integrations\n\n- GitHub integration\n- Webhooks API\n- CLI tool\n\n## v0.3, Collaboration\n\n- Comments on issues\n- Notifications\n- Activity feed",
  },
];

const STATUSES: Status[] = ["backlog", "todo", "in-progress", "done", "cancelled"];
const STATUS_LABELS: Record<Status, string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];
const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

const FILTERS = [
  { id: "all", label: "All Issues" },
  { id: "active", label: "Active" },
  { id: "backlog", label: "Backlog" },
  { id: "done", label: "Done" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function Icon({
  name,
  size = 14,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const p = {
    stroke: color,
    strokeWidth: "1.3",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const icons: Record<string, React.ReactNode> = {
    issues: (
      <>
        <circle cx="7" cy="7" r="5.5" {...p} />
        <path d="M7 4.5v2.8l1.8 1" {...p} />
      </>
    ),
    documents: <path d="M4 2h5l3 3v7H3V2h1m0 0v2.5H9" {...p} />,
    chevronRight: <path d="M5.5 3.5L9 7l-3.5 3.5" {...p} />,
    chevronDown: <path d="M3.5 5.5L7 9l3.5-3.5" {...p} />,
    plus: <path d="M7 2v10M2 7h10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />,
    x: <path d="M3 3l8 8M11 3l-8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />,
    user: (
      <>
        <circle cx="7" cy="5" r="2.5" {...p} />
        <path d="M2.5 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" {...p} />
      </>
    ),
    myissues: (
      <>
        <circle cx="6.5" cy="5" r="2" {...p} />
        <path d="M3 12c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5" {...p} />
        <path d="M10 8.5l1 1 2-2" {...p} />
      </>
    ),
    github: (
      <path d="M7 1.5A5.5 5.5 0 0 0 5.3 12.3c.27.05.37-.12.37-.26v-.9c-1.52.33-1.84-.73-1.84-.73-.25-.63-.61-.8-.61-.8-.5-.34.04-.33.04-.33.55.04.84.57.84.57.49.84 1.28.6 1.6.46.05-.36.19-.6.35-.74-1.21-.14-2.49-.6-2.49-2.69 0-.6.21-1.08.56-1.46-.06-.14-.24-.69.05-1.44 0 0 .46-.15 1.5.56A5.2 5.2 0 0 1 7 4.7c.46 0 .93.06 1.37.18 1.04-.71 1.5-.56 1.5-.56.29.75.11 1.3.05 1.44.35.38.56.87.56 1.46 0 2.09-1.28 2.55-2.5 2.69.2.17.37.5.37 1.01v1.5c0 .14.1.31.38.26A5.5 5.5 0 0 0 7 1.5Z" fill={color} stroke="none" />
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      {icons[name] ?? null}
    </svg>
  );
}

function PriorityIcon({ priority, size = 12 }: { priority: Priority; size?: number }) {
  const configs: Record<Priority, { filled: number; color: string }> = {
    urgent: { filled: 3, color: "#ef4444" },
    high: { filled: 3, color: "#f97316" },
    medium: { filled: 2, color: "#eab308" },
    low: { filled: 1, color: "#94a3b8" },
    none: { filled: 0, color: "#d1d5db" },
  };
  const cfg = configs[priority];
  const heights = [3, 6, 9];

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      {heights.map((h, index) => (
        <rect
          key={index}
          x={index * 4 + 0.5}
          y={12 - h}
          width="3"
          height={h}
          rx="0.5"
          fill={index < cfg.filled ? cfg.color : "#e5e7eb"}
        />
      ))}
    </svg>
  );
}

function StatusIcon({
  status,
  size = 14,
}: {
  status: Status;
  size?: number;
}) {
  const icons: Record<Status, React.ReactNode> = {
    backlog: <circle cx="7" cy="7" r="5.5" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="2.5 2" />,
    todo: <circle cx="7" cy="7" r="5.5" stroke="#6b7280" strokeWidth="1.5" />,
    "in-progress": (
      <>
        <circle cx="7" cy="7" r="5.5" stroke="#3b82f6" strokeWidth="1.5" />
        <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7 L7 7 Z" fill="#3b82f6" />
      </>
    ),
    done: (
      <>
        <circle cx="7" cy="7" r="6.5" fill="#22c55e" />
        <path
          d="M4.5 7.2 L6.3 9 L9.5 5.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
    cancelled: (
      <>
        <circle cx="7" cy="7" r="6.5" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
        <path d="M5 5 L9 9 M9 5 L5 9" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      {icons[status]}
    </svg>
  );
}

function LabelBadge({ label }: { label: Label }) {
  const colors: Record<Label, { bg: string; text: string; dot: string }> = {
    bug: { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
    feature: { bg: "#faf5ff", text: "#7c3aed", dot: "#8b5cf6" },
    improvement: { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
    docs: { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  };
  const color = colors[label];

  return (
    <span className="dispatch-label-badge" style={{ background: color.bg, color: color.text }}>
      <span className="dispatch-label-dot" style={{ background: color.dot }} />
      {label}
    </span>
  );
}

function filterIssues(issues: Issue[], filter: FilterId) {
  if (filter === "active") return issues.filter((issue) => ["todo", "in-progress"].includes(issue.status));
  if (filter === "backlog") return issues.filter((issue) => issue.status === "backlog");
  if (filter === "done") return issues.filter((issue) => ["done", "cancelled"].includes(issue.status));
  return issues;
}

function renderBody(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("## ")) {
      return (
        <div key={index} className="dispatch-body-h2">
          {line.slice(3)}
        </div>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <div key={index} className="dispatch-body-h1">
          {line.slice(2)}
        </div>
      );
    }
    if (line.startsWith("- [x] ")) {
      return (
        <div key={index} className="dispatch-body-check dispatch-body-check-done">
          <span className="dispatch-body-checkmark">✓</span>
          {line.slice(6)}
        </div>
      );
    }
    if (line.startsWith("- [ ] ")) {
      return (
        <div key={index} className="dispatch-body-check">
          <span className="dispatch-body-circle">○</span>
          {line.slice(6)}
        </div>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <div key={index} className="dispatch-body-bullet">
          • {line.slice(2)}
        </div>
      );
    }
    if (line === "") return <div key={index} style={{ height: 6 }} />;
    return (
      <div key={index} className="dispatch-body-copy">
        {line}
      </div>
    );
  });
}

function renderDoc(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index} className="dispatch-doc-h1">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={index} className="dispatch-doc-h2">{line.slice(3)}</h2>;
    if (line.startsWith("- ")) {
      return (
        <div key={index} className="dispatch-doc-bullet">
          <span className="dispatch-doc-bullet-mark">-</span>
          {line.slice(2)}
        </div>
      );
    }
    if (line === "") return <div key={index} style={{ height: 8 }} />;
    return <p key={index} className="dispatch-doc-copy">{line}</p>;
  });
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`dispatch-nav-item${active ? " is-active" : ""}`}>
      <Icon name={icon} size={14} color={active ? "var(--accent)" : "var(--text-3)"} />
      <span className="dispatch-nav-item-label">{label}</span>
      {count != null ? <span className="dispatch-nav-item-count">{count}</span> : null}
    </button>
  );
}

function Sidebar({
  nav,
  setNav,
  projects,
  selectedProject,
  setSelectedProject,
  user,
}: {
  nav: string;
  setNav: (nav: string) => void;
  projects: Project[];
  selectedProject: string;
  setSelectedProject: (id: string) => void;
  user: User;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ p1: true, p2: false });

  const toggle = (id: string) => setExpanded((current) => ({ ...current, [id]: !current[id] }));
  const goProject = (projectId: string, view: string) => {
    setSelectedProject(projectId);
    setNav(view);
  };

  return (
    <aside className="dispatch-sidebar">
      <div className="dispatch-sidebar-header">
        <div className="dispatch-brand-mark">
          <span>D</span>
        </div>
        <span className="dispatch-brand-name">Dispatch</span>
      </div>

      <div className="dispatch-sidebar-scroll">
        <NavItem icon="myissues" label="My Issues" active={nav === "my-issues"} onClick={() => setNav("my-issues")} />

        <div className="dispatch-projects">
          <div className="dispatch-section-title">Projects</div>

          {projects.map((project) => {
            const isExpanded = expanded[project.id];
            const issueActive = nav === "issues" && selectedProject === project.id;
            const docActive = nav === "documents" && selectedProject === project.id;

            return (
              <div key={project.id}>
                <div className="dispatch-project-header">
                  <button onClick={() => toggle(project.id)} className="dispatch-project-toggle" aria-label="Toggle project">
                    <Icon name={isExpanded ? "chevronDown" : "chevronRight"} size={12} color="var(--text-3)" />
                  </button>
                  <button onClick={() => goProject(project.id, "issues")} className="dispatch-project-button">
                    <div className="dispatch-project-mark" style={{ background: project.color }}>
                      <span>{project.key[0]}</span>
                    </div>
                    <span className="dispatch-project-name">{project.name}</span>
                  </button>
                </div>

                {isExpanded ? (
                  <div className="dispatch-project-subnav">
                    {[
                      { id: "issues", icon: "issues", label: "Issues", active: issueActive },
                      { id: "documents", icon: "documents", label: "Documents", active: docActive },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => goProject(project.id, item.id)}
                        className={`dispatch-project-subnav-item${item.active ? " is-active" : ""}`}
                      >
                        <Icon name={item.icon} size={13} color={item.active ? "var(--accent)" : "var(--text-3)"} />
                        {item.label}
                      </button>
                    ))}

                    {project.subProjects.length ? (
                      <div className="dispatch-subproject-list">
                        {project.subProjects.map((subProject) => (
                          <div key={subProject.id} className="dispatch-subproject">
                            <div className="dispatch-subproject-color" style={{ background: subProject.color }} />
                            {subProject.name}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dispatch-sidebar-footer">
        <NavItem icon="user" label="Profile" active={nav === "settings-profile"} onClick={() => setNav("settings-profile")} />
        <NavItem icon="github" label="Integrations" active={nav === "settings-integrations"} onClick={() => setNav("settings-integrations")} />

        <div className="dispatch-user-card">
          <div className="dispatch-avatar dispatch-avatar-small">{user.initials}</div>
          <div className="dispatch-user-meta">
            <div className="dispatch-user-name">{user.name}</div>
            <div className="dispatch-user-email">{user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CreateIssueModal({
  projectId,
  onClose,
  onCreate,
}: {
  projectId: string;
  onClose: () => void;
  onCreate: (payload: { title: string; body: string; status: Status; priority: Priority; projectId: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), body, status, priority, projectId });
    onClose();
  };

  return (
    <div className="dispatch-modal-scrim" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dispatch-modal"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleCreate();
        }}
      >
        <div className="dispatch-modal-header">
          <div className="dispatch-modal-mark" />
          <span>New Issue</span>
        </div>
        <div className="dispatch-modal-title-wrap">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Issue title"
            rows={1}
            className="dispatch-modal-title"
          />
        </div>
        <div className="dispatch-modal-body-wrap">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add description... (optional)"
            rows={3}
            className="dispatch-modal-body"
          />
        </div>
        <div className="dispatch-modal-footer">
          <select value={status} onChange={(event) => setStatus(event.target.value as Status)} className="dispatch-select">
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="dispatch-select">
            {PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item === "none" ? "No priority" : item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
          <div className="dispatch-spacer" />
          <button onClick={onClose} className="dispatch-button dispatch-button-secondary">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!title.trim()} className="dispatch-button dispatch-button-primary">
            Create issue
          </button>
        </div>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  allIssues,
  isSelected,
  onSelect,
}: {
  issue: Issue;
  allIssues: Issue[];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const parent = issue.parentId ? allIssues.find((item) => item.id === issue.parentId) : null;
  const isStrike = issue.status === "cancelled" || issue.status === "done";

  return (
    <div onClick={() => onSelect(issue.id)} className={`dispatch-issue-row${isSelected ? " is-selected" : ""}`}>
      {isSelected ? <div className="dispatch-issue-selected-bar" /> : null}
      <div className="dispatch-issue-priority">
        <PriorityIcon priority={issue.priority} size={11} />
      </div>
      <div className="dispatch-issue-key">{issue.key}</div>
      <div className="dispatch-issue-status">
        <StatusIcon status={issue.status} size={13} />
      </div>
      <div className="dispatch-issue-title-wrap">
        <span className={`dispatch-issue-title${isStrike ? " is-muted" : ""}`}>{issue.title}</span>
        {parent ? (
          <span className="dispatch-issue-parent">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M2 4h4M4 2l2 2-2 2" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="dispatch-issue-parent-title">{parent.title}</span>
          </span>
        ) : null}
      </div>
      {issue.labels.length ? (
        <div className="dispatch-issue-labels">
          {issue.labels.slice(0, 2).map((label) => (
            <LabelBadge key={label} label={label} />
          ))}
        </div>
      ) : null}
      <div className="dispatch-issue-date">
        {new Date(issue.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

function IssueGroup({
  status,
  issues,
  allIssues,
  selectedIssue,
  onSelectIssue,
}: {
  status: Status;
  issues: Issue[];
  allIssues: Issue[];
  selectedIssue: string | null;
  onSelectIssue: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!issues.length) return null;

  return (
    <div>
      <button onClick={() => setCollapsed((current) => !current)} className="dispatch-group-header">
        <Icon name={collapsed ? "chevronRight" : "chevronDown"} size={11} color="var(--text-3)" />
        <StatusIcon status={status} size={11} />
        <span>{STATUS_LABELS[status]}</span>
        <span className="dispatch-group-count">{issues.length}</span>
      </button>
      {collapsed
        ? null
        : issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              allIssues={allIssues}
              isSelected={selectedIssue === issue.id}
              onSelect={onSelectIssue}
            />
          ))}
    </div>
  );
}

function IssueList({
  issues,
  allIssues,
  project,
  selectedIssue,
  onSelectIssue,
  onCreateIssue,
  myIssues,
  userId,
  loading,
}: {
  issues: Issue[];
  allIssues: Issue[];
  project: Project;
  selectedIssue: string | null;
  onSelectIssue: (id: string) => void;
  onCreateIssue: (payload: { title: string; body: string; status: Status; priority: Priority; projectId: string }) => void;
  myIssues: boolean;
  userId: string;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "c" && !event.metaKey && !event.ctrlKey && document.activeElement?.tagName === "BODY") {
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const base = myIssues
    ? issues.filter((issue) => issue.assignee === userId && !issue.parentId)
    : issues.filter((issue) => issue.projectId === project.id && !issue.parentId);

  const filtered = filterIssues(base, filter);
  const grouped = Object.fromEntries(STATUSES.map((status) => [status, filtered.filter((issue) => issue.status === status)])) as Record<
    Status,
    Issue[]
  >;

  return (
    <section className="dispatch-main-panel">
      <div className="dispatch-pane-header">
        <div className="dispatch-pane-title-row">
          {myIssues ? (
            <span className="dispatch-pane-title-strong">My Issues</span>
          ) : (
            <>
              <div className="dispatch-pane-project-mark" style={{ background: project.color }}>
                <span>{project.key[0]}</span>
              </div>
              <span className="dispatch-pane-title-subtle">{project.name}</span>
              <span className="dispatch-pane-divider">/</span>
              <span className="dispatch-pane-title-strong">Issues</span>
            </>
          )}
          <div className="dispatch-spacer" />
          {!myIssues ? (
            <button onClick={() => setCreateOpen(true)} className="dispatch-accent-button">
              <Icon name="plus" size={11} color="white" /> New issue
            </button>
          ) : null}
        </div>

        <div className="dispatch-filter-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`dispatch-filter-tab${filter === item.id ? " is-active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dispatch-scroll-panel">
        {loading ? (
          <div className="dispatch-empty-state">Loading...</div>
        ) : (
          <>
            {STATUSES.map((status) => (
              <IssueGroup
                key={status}
                status={status}
                issues={grouped[status]}
                allIssues={allIssues}
                selectedIssue={selectedIssue}
                onSelectIssue={onSelectIssue}
              />
            ))}
            {!filtered.length ? <div className="dispatch-empty-state">No issues</div> : null}
          </>
        )}
      </div>

      {createOpen ? <CreateIssueModal projectId={project.id} onClose={() => setCreateOpen(false)} onCreate={onCreateIssue} /> : null}
    </section>
  );
}

function Dropdown({
  trigger,
  children,
  open,
  setOpen,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  return (
    <div ref={ref} className="dispatch-dropdown">
      {trigger}
      {open ? <div className="dispatch-dropdown-menu">{children}</div> : null}
    </div>
  );
}

function DropItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`dispatch-drop-item${active ? " is-active" : ""}`}>
      {children}
    </button>
  );
}

function PickerButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="dispatch-picker-button">
      {children}
    </button>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="dispatch-meta-row">
      <span className="dispatch-meta-label">{label}</span>
      <div className="dispatch-meta-content">{children}</div>
    </div>
  );
}

function IssueDetail({
  issue,
  allIssues,
  onClose,
  onUpdate,
  project,
  myIssues,
  user,
}: {
  issue: Issue;
  allIssues: Issue[];
  onClose: () => void;
  onUpdate: (issue: Issue) => void;
  project: Project;
  myIssues: boolean;
  user: User;
}) {
  const [title, setTitle] = useState(issue.title);
  const [body, setBody] = useState(issue.body);
  const [editBody, setEditBody] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const update = (patch: Partial<Issue>) => onUpdate({ ...issue, ...patch });
  const subIssues = allIssues.filter((item) => item.parentId === issue.id);
  const blockedBy = issue.blockedBy.map((id) => allIssues.find((item) => item.id === id)).filter(Boolean) as Issue[];
  const relatedTo = issue.relatedTo.map((id) => allIssues.find((item) => item.id === id)).filter(Boolean) as Issue[];

  const toggleLabel = (label: Label) => {
    const next = issue.labels.includes(label) ? issue.labels.filter((item) => item !== label) : [...issue.labels, label];
    update({ labels: next });
  };

  return (
    <section className="dispatch-detail-panel">
      <div className="dispatch-detail-header">
        <button onClick={onClose} className="dispatch-breadcrumb-button">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {myIssues ? "My Issues" : `${project.name} / Issues`}
        </button>
        <span className="dispatch-pane-divider">/</span>
        <span className="dispatch-detail-key">{issue.key}</span>
        <StatusIcon status={issue.status} size={12} />
        <span className="dispatch-detail-status">{STATUS_LABELS[issue.status]}</span>
      </div>

      <div className="dispatch-detail-shell">
        <div className="dispatch-detail-content">
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => title !== issue.title && update({ title })}
            className="dispatch-detail-title"
            rows={2}
          />

          {editBody ? (
            <textarea
              value={body}
              autoFocus
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => {
                setEditBody(false);
                if (body !== issue.body) update({ body });
              }}
              rows={8}
              className="dispatch-detail-body-editor"
            />
          ) : (
            <div onClick={() => setEditBody(true)} className="dispatch-detail-body">
              {body ? renderBody(body) : <span className="dispatch-detail-body-placeholder">Add description...</span>}
            </div>
          )}

          <div className="dispatch-subissues">
            <div className="dispatch-subissues-title">
              Sub-issues{subIssues.length ? ` (${subIssues.length})` : ""}
            </div>
            {subIssues.map((subIssue) => (
              <div key={subIssue.id} className="dispatch-subissue-row">
                <PriorityIcon priority={subIssue.priority} size={10} />
                <StatusIcon status={subIssue.status} size={12} />
                <span className="dispatch-subissue-key">{subIssue.key}</span>
                <span className="dispatch-subissue-title">{subIssue.title}</span>
              </div>
            ))}
            <button className="dispatch-subissue-add">
              <Icon name="plus" size={11} color="var(--text-3)" /> Add sub-issue
            </button>
          </div>
        </div>

        <div className="dispatch-meta-panel">
          <MetaRow label="Status">
            <Dropdown
              open={statusOpen}
              setOpen={setStatusOpen}
              trigger={
                <PickerButton onClick={() => setStatusOpen(!statusOpen)}>
                  <StatusIcon status={issue.status} size={12} />
                  {STATUS_LABELS[issue.status]}
                </PickerButton>
              }
            >
              {STATUSES.map((status) => (
                <DropItem key={status} active={issue.status === status} onClick={() => { update({ status }); setStatusOpen(false); }}>
                  <StatusIcon status={status} size={12} />
                  {STATUS_LABELS[status]}
                </DropItem>
              ))}
            </Dropdown>
          </MetaRow>

          <MetaRow label="Priority">
            <Dropdown
              open={priorityOpen}
              setOpen={setPriorityOpen}
              trigger={
                <PickerButton onClick={() => setPriorityOpen(!priorityOpen)}>
                  <PriorityIcon priority={issue.priority} size={11} />
                  {PRIORITY_LABELS[issue.priority]}
                </PickerButton>
              }
            >
              {PRIORITIES.map((priority) => (
                <DropItem key={priority} active={issue.priority === priority} onClick={() => { update({ priority }); setPriorityOpen(false); }}>
                  <PriorityIcon priority={priority} size={11} />
                  {PRIORITY_LABELS[priority]}
                </DropItem>
              ))}
            </Dropdown>
          </MetaRow>

          <MetaRow label="Labels">
            <Dropdown
              open={labelsOpen}
              setOpen={setLabelsOpen}
              trigger={
                <PickerButton onClick={() => setLabelsOpen(!labelsOpen)}>
                  {issue.labels.length ? issue.labels.map((label) => <LabelBadge key={label} label={label} />) : <span className="dispatch-placeholder">None</span>}
                </PickerButton>
              }
            >
              {(Object.keys({ bug: true, feature: true, improvement: true, docs: true }) as Label[]).map((label) => (
                <DropItem key={label} active={issue.labels.includes(label)} onClick={() => toggleLabel(label)}>
                  <LabelBadge label={label} />
                  {issue.labels.includes(label) ? <span className="dispatch-drop-check">✓</span> : null}
                </DropItem>
              ))}
            </Dropdown>
          </MetaRow>

          <MetaRow label="Assignee">
            <div className="dispatch-assignee">
              {issue.assignee ? (
                <>
                  <div className="dispatch-avatar dispatch-avatar-tiny">{user.initials}</div>
                  <span className="dispatch-assignee-name">{user.name}</span>
                </>
              ) : (
                <span className="dispatch-placeholder">Unassigned</span>
              )}
            </div>
          </MetaRow>

          {relatedTo.length ? (
            <MetaRow label="Related">
              <div className="dispatch-meta-links">
                {relatedTo.map((related) => (
                  <div key={related.id} className="dispatch-meta-link-row">
                    <StatusIcon status={related.status} size={10} />
                    <span className="dispatch-meta-key">{related.key}</span>
                    <span className="dispatch-meta-title">{related.title}</span>
                  </div>
                ))}
              </div>
            </MetaRow>
          ) : null}

          {blockedBy.length ? (
            <MetaRow label="Blocked by">
              <div className="dispatch-meta-links">
                {blockedBy.map((blocked) => (
                  <div key={blocked.id} className="dispatch-meta-link-row">
                    <StatusIcon status={blocked.status} size={10} />
                    <span className="dispatch-meta-key is-danger">{blocked.key}</span>
                    <span className="dispatch-meta-title">{blocked.title}</span>
                  </div>
                ))}
              </div>
            </MetaRow>
          ) : null}

          <div className="dispatch-created-meta">
            <div>Created</div>
            <div>{new Date(issue.createdAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DocumentsView({
  documents,
  project,
}: {
  documents: DocumentRecord[];
  project: Project;
}) {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const projectDocs = documents.filter((doc) => doc.projectId === project.id);
  const doc = selectedDoc ? projectDocs.find((item) => item.id === selectedDoc) ?? null : null;

  return (
    <section className="dispatch-documents">
      <div className="dispatch-doc-list">
        <div className="dispatch-pane-header">
          <div className="dispatch-pane-title-row">
            <div className="dispatch-pane-project-mark" style={{ background: project.color }}>
              <span>{project.key[0]}</span>
            </div>
            <span className="dispatch-pane-title-subtle">{project.name}</span>
            <span className="dispatch-pane-divider">/</span>
            <span className="dispatch-pane-title-strong">Documents</span>
            <div className="dispatch-spacer" />
            <button className="dispatch-accent-button">
              <Icon name="plus" size={11} color="white" /> New doc
            </button>
          </div>
        </div>

        <div className="dispatch-scroll-panel">
          {projectDocs.length ? (
            projectDocs.map((item) => {
              const isActive = selectedDoc === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedDoc(isActive ? null : item.id)}
                  className={`dispatch-doc-list-item${isActive ? " is-active" : ""}`}
                >
                  <div className="dispatch-doc-list-title">{item.title}</div>
                  <div className="dispatch-doc-list-date">
                    Updated {new Date(item.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="dispatch-empty-state">No documents yet</div>
          )}
        </div>
      </div>

      {doc ? (
        <div className="dispatch-doc-detail">
          <div className="dispatch-doc-detail-header">
            <Icon name="documents" size={13} color="var(--text-3)" />
            <span className="dispatch-doc-detail-title">{doc.title}</span>
            <span className="dispatch-doc-detail-date">
              Updated {new Date(doc.updatedAt).toLocaleDateString("en", { month: "long", day: "numeric" })}
            </span>
            <button onClick={() => setSelectedDoc(null)} className="dispatch-icon-button">
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="dispatch-scroll-panel">
            <div className="dispatch-doc-prose">{renderDoc(doc.body)}</div>
          </div>
        </div>
      ) : (
        <div className="dispatch-doc-empty">
          <Icon name="documents" size={28} color="var(--border)" />
          <span>Select a document to view</span>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="dispatch-field">
      <label className="dispatch-field-label">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="dispatch-field-input" />
    </div>
  );
}

function SettingsShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dispatch-settings-shell">
      <div className="dispatch-settings-header">
        <span className="dispatch-pane-title-strong">{title}</span>
      </div>
      <div className="dispatch-settings-content">{children}</div>
    </section>
  );
}

function ProfileSettings({ user, setUser }: { user: User; setUser: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setUser({ ...user, name, email });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <SettingsShell title="Profile">
      <div className="dispatch-profile-header">
        <div className="dispatch-avatar dispatch-avatar-large">{user.initials}</div>
        <div>
          <div className="dispatch-profile-name">{name}</div>
          <div className="dispatch-profile-email">{email}</div>
        </div>
      </div>

      <Field label="Full name" value={name} onChange={setName} />
      <Field label="Email address" value={email} onChange={setEmail} type="email" />

      <button onClick={save} className={`dispatch-save-button${saved ? " is-saved" : ""}`}>
        {saved ? "✓ Saved" : "Save changes"}
      </button>
    </SettingsShell>
  );
}

function IntegrationSettings() {
  const [connected, setConnected] = useState(false);
  const [repo, setRepo] = useState("");
  const [linked, setLinked] = useState(false);

  return (
    <SettingsShell title="Integrations">
      <div className="dispatch-integration-card">
        <div className="dispatch-integration-header">
          <div className="dispatch-integration-mark">
            <Icon name="github" size={20} color="var(--surface)" />
          </div>
          <div className="dispatch-integration-copy">
            <div className="dispatch-integration-title">GitHub</div>
            <div className="dispatch-integration-body">
              {connected ? "Connected, link commits and PRs to issues" : "Link commits and PRs to issues automatically"}
            </div>
          </div>
          {connected ? (
            <button onClick={() => { setConnected(false); setRepo(""); setLinked(false); }} className="dispatch-button dispatch-button-secondary">
              Disconnect
            </button>
          ) : (
            <button onClick={() => setConnected(true)} className="dispatch-button dispatch-button-dark">
              Connect
            </button>
          )}
        </div>

        {connected ? (
          <div>
            <div className="dispatch-inline-label">Repository</div>
            <div className="dispatch-integration-form">
              <input
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && repo && setLinked(true)}
                placeholder="owner/repository"
                className="dispatch-repo-input"
              />
              <button onClick={() => repo && setLinked(true)} className="dispatch-button dispatch-button-primary" disabled={!repo}>
                Link
              </button>
            </div>

            {linked ? (
              <div className="dispatch-success-note">
                <span className="dispatch-body-checkmark">✓</span>
                <span>
                  <strong>{repo}</strong> linked. Commits referencing issue keys like <code>DSP-4</code> will be linked automatically.
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="dispatch-soon-card">More integrations coming soon</div>
    </SettingsShell>
  );
}

function SettingsView({
  view,
  user,
  setUser,
}: {
  view: string;
  user: User;
  setUser: (user: User) => void;
}) {
  if (view === "settings-profile") return <ProfileSettings user={user} setUser={setUser} />;
  return <IntegrationSettings />;
}

export function DispatchApp({
  initialUser,
  initialProjects,
}: {
  initialUser: ApiUser;
  initialProjects: ApiProject[];
}) {
  const [user, setUser] = useState<User>(() => mapApiUser(initialUser));
  const [projects] = useState<Project[]>(() => initialProjects.map(mapApiProject));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [nav, setNav] = useState("issues");
  const [selectedProject, setSelectedProject] = useState<string>(
    initialProjects[0]?.id ?? "",
  );
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  const project = projects.find((item) => item.id === selectedProject) ?? projects[0];
  const isMyIssues = nav === "my-issues";
  const isIssues = nav === "issues" || isMyIssues;
  const isDocs = nav === "documents";
  const isSettings = nav.startsWith("settings-");

  useEffect(() => {
    if (!isIssues || !selectedProject) return;

    let cancelled = false;
    setIssuesLoading(true);

    const load = async () => {
      try {
        let loaded: Issue[];
        if (isMyIssues) {
          const results = await Promise.all(
            projects.map((p) => listProjectIssues(p.id)),
          );
          loaded = results.flat().map(mapApiIssue);
        } else {
          loaded = (await listProjectIssues(selectedProject)).map(mapApiIssue);
        }
        if (!cancelled) setIssues(loaded);
      } catch (err) {
        console.error("Failed to load issues:", err);
      } finally {
        if (!cancelled) setIssuesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  // projects is stable (never updated), intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, isMyIssues]);

  const handleSelectIssue = (id: string) => setSelectedIssue((current) => (current === id ? null : id));

  const handleCreateIssue = async ({
    title,
    body,
    status,
    priority,
    projectId,
  }: {
    title: string;
    body: string;
    status: Status;
    priority: Priority;
    projectId: string;
  }) => {
    try {
      const created = await apiCreateIssue({
        project_id: projectId,
        title,
        body,
        status,
        priority,
        assignee_id: user.id,
      });
      const mapped = mapApiIssue(created);
      setIssues((current) => [mapped, ...current]);
      setSelectedIssue(mapped.id);
    } catch (err) {
      console.error("Failed to create issue:", err);
    }
  };

  const handleUpdateIssue = (updated: Issue) => {
    // Optimistic update
    setIssues((current) =>
      current.map((issue) => (issue.id === updated.id ? updated : issue)),
    );
    // Sync to API, then reconcile with server response
    apiUpdateIssue(updated.id, {
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      labels: updated.labels,
      body: updated.body,
      assignee_id: updated.assignee,
      parent_id: updated.parentId,
    })
      .then((result) => {
        setIssues((current) =>
          current.map((issue) =>
            issue.id === result.id ? mapApiIssue(result) : issue,
          ),
        );
      })
      .catch((err) => {
        console.error("Failed to update issue:", err);
      });
  };

  const handleSetNav = (nextNav: string) => {
    setNav(nextNav);
    if (!["issues", "my-issues"].includes(nextNav)) setSelectedIssue(null);
  };

  const handleSetProject = (id: string) => {
    setSelectedProject(id);
    setSelectedIssue(null);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIssue(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selectedIssueObj = selectedIssue ? issues.find((issue) => issue.id === selectedIssue) ?? null : null;

  if (!project) {
    return (
      <div className="dispatch-app-shell">
        <main className="dispatch-main-shell">
          <div className="dispatch-empty-state">No projects found.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="dispatch-app-shell">
      <Sidebar
        nav={nav}
        setNav={handleSetNav}
        projects={projects}
        selectedProject={selectedProject}
        setSelectedProject={handleSetProject}
        user={user}
      />

      <main className="dispatch-main-shell">
        {isIssues ? (
          selectedIssueObj ? (
            <IssueDetail
              key={selectedIssueObj.id}
              issue={selectedIssueObj}
              allIssues={issues}
              onClose={() => setSelectedIssue(null)}
              onUpdate={handleUpdateIssue}
              project={project}
              myIssues={isMyIssues}
              user={user}
            />
          ) : (
            <IssueList
              issues={issues}
              allIssues={issues}
              project={project}
              selectedIssue={selectedIssue}
              onSelectIssue={handleSelectIssue}
              onCreateIssue={handleCreateIssue}
              myIssues={isMyIssues}
              userId={user.id}
              loading={issuesLoading}
            />
          )
        ) : null}

        {isDocs ? <DocumentsView documents={DOCUMENTS} project={project} /> : null}
        {isSettings ? <SettingsView view={nav} user={user} setUser={setUser} /> : null}
      </main>
    </div>
  );
}
