import type { Session } from "./client";
import { kratosClient } from "./client";

/**
 * Fetch the active session from Kratos.
 *
 * Pass `cookie` when calling from a Next.js server component or route handler
 * so Kratos can identify the session from the forwarded request headers.
 * In browser contexts the cookie is sent automatically.
 *
 * Returns `null` when unauthenticated (no active session).
 */
export async function getSession(cookie?: string): Promise<Session | null> {
  try {
    const { data } = await kratosClient.toSession({ cookie });
    return data;
  } catch (err: unknown) {
    if (isUnauthorized(err)) return null;
    throw err;
  }
}

/**
 * Obtain a logout URL for the current session.
 * Redirect the user to this URL to log them out cleanly.
 */
export async function createLogoutUrl(cookie?: string): Promise<string | null> {
  try {
    const { data } = await kratosClient.createBrowserLogoutFlow({ cookie });
    return data.logout_url;
  } catch {
    return null;
  }
}

/**
 * Extract the plain e-mail address from a Kratos session.
 */
export function getIdentityEmail(session: Session): string {
  return ((session.identity?.traits as Record<string, unknown>)?.email as string) ?? "";
}

/**
 * Extract a display name from a Kratos session.
 * Supports both a flat `name` string and a `{ first, last }` object in identity traits.
 * Falls back to the part before "@" in the email when no name is set.
 */
export function getIdentityName(session: Session): string | null {
  const traits = session.identity?.traits as Record<string, unknown> | undefined;
  if (!traits) return null;

  const name = traits.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  if (name && typeof name === "object") {
    const { first, last } = name as { first?: string; last?: string };
    const full = [first, last].filter(Boolean).join(" ");
    if (full) return full;
  }

  const email = getIdentityEmail(session);
  return email ? email.split("@")[0] : null;
}

function isUnauthorized(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 401 || status === 403;
}
