import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/kratos/session";
import { getMe, listProjects } from "@/lib/api/client";
import { DispatchApp } from "./dispatch-app";

export default async function Home() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession(cookieHeader);
  } catch {
    return <ServiceUnavailable />;
  }

  if (!session) {
    const kratosUrl =
      process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";
    redirect(`${kratosUrl}/self-service/login/browser`);
  }

  let user: Awaited<ReturnType<typeof getMe>>;
  let projects: Awaited<ReturnType<typeof listProjects>>;
  try {
    [user, projects] = await Promise.all([
      getMe(cookieHeader),
      listProjects(cookieHeader),
    ]);
  } catch {
    return <ServiceUnavailable />;
  }

  return <DispatchApp initialUser={user} initialProjects={projects} />;
}

function ServiceUnavailable() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100dvh",
        fontFamily: "system-ui, sans-serif",
        color: "#6b7280",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: "#374151" }}>
        Service unavailable
      </div>
      <div style={{ fontSize: 13 }}>
        Could not reach the authentication service. Try again in a moment.
      </div>
    </div>
  );
}
