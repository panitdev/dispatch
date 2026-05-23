// API response types — mirror the Rust models exactly (snake_case)

export type ApiUser = {
  id: string;
  kratos_id: string;
  name: string;
  initials: string;
  email: string;
  created_at: string;
};

export type ApiProject = {
  id: string;
  key: string;
  name: string;
  color: string;
  parent_id: string | null;
  sub_projects: ApiProject[];
  created_at: string;
  updated_at: string;
};

export type ApiIssue = {
  id: string;
  key: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  status: string;
  priority: string;
  labels: string[];
  assignee_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  blocked_by: string[];
  related_to: string[];
};

export type CreateIssueBody = {
  project_id: string;
  title: string;
  status?: string;
  priority?: string;
  labels?: string[];
  parent_id?: string | null;
  assignee_id?: string | null;
  body?: string;
};

// outer Option<Option<T>>: omit = no change, null = clear, string = set
export type UpdateIssueBody = {
  title?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  body?: string;
  assignee_id?: string | null;
  parent_id?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  cookie?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(
      `API ${options.method ?? "GET"} ${path} failed: ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getMe(cookie?: string): Promise<ApiUser> {
  return apiFetch("/api/v1/me", {}, cookie);
}

export function listProjects(cookie?: string): Promise<ApiProject[]> {
  return apiFetch("/api/v1/projects", {}, cookie);
}

export function listProjectIssues(projectId: string): Promise<ApiIssue[]> {
  return apiFetch(`/api/v1/projects/${projectId}/issues`);
}

export function createIssue(body: CreateIssueBody): Promise<ApiIssue> {
  return apiFetch("/api/v1/issues", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateIssue(
  id: string,
  body: UpdateIssueBody,
): Promise<ApiIssue> {
  return apiFetch(`/api/v1/issues/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteIssue(id: string): Promise<void> {
  return apiFetch(`/api/v1/issues/${id}`, { method: "DELETE" });
}
