import { parseSessionId } from "../shared/session-id.ts";
import type { Project, SessionSummary } from "../shared/types.ts";
import { getFrontendPlugin } from "./plugin-registry.ts";
import { getRPC } from "./rpc.ts";

const HASH_PREFIX_REGEX = /^#\/?/;

export type ViewState =
  | { kind: "home" }
  | { kind: "hidden" }
  | { kind: "settings" }
  | { kind: "project"; project: Project }
  | {
      kind: "session";
      project: Project;
      session: SessionSummary;
      presenting: boolean;
    }
  | {
      kind: "subagent";
      project: Project;
      sessionId: string;
      agentId: string;
      presenting: boolean;
    };

export function getResumeCommand(
  pluginId: string | undefined,
  encodedSessionId: string,
): string | undefined {
  const parsedSessionId = parseSessionId(encodedSessionId);
  const resolvedPluginId = pluginId ?? parsedSessionId.pluginId ?? undefined;
  if (!resolvedPluginId || !parsedSessionId.rawSessionId) return;
  return (
    getFrontendPlugin(resolvedPluginId)?.getResumeCommand?.(parsedSessionId.rawSessionId) ??
    undefined
  );
}

export function viewToHash(view: ViewState): string {
  if (view.kind === "hidden") return "#/hidden";
  if (view.kind === "settings") return "#/settings";
  if (view.kind === "project") return `#/${view.project.encodedPath}`;
  if (view.kind === "session") return `#/${view.project.encodedPath}/${view.session.sessionId}`;
  if (view.kind === "subagent")
    return `#/${view.project.encodedPath}/${view.sessionId}/subagent/${view.agentId}`;
  return "#/";
}

async function loadProject(encodedPath: string): Promise<Project | undefined> {
  const data = await getRPC().request.getProjects({});
  return data.projects.find((p) => p.encodedPath === encodedPath);
}

async function loadProjectSession(
  project: Project,
  sessionId: string,
): Promise<SessionSummary | undefined> {
  const data = await getRPC().request.getSessions({ encodedPath: project.encodedPath });
  return data.sessions.find((s) => s.sessionId === sessionId);
}

export async function resolveProjectAndSession(
  encodedPath: string,
  sessionId: string,
): Promise<{ project: Project; session: SessionSummary } | null> {
  try {
    const project = await loadProject(encodedPath);
    if (!project) return null;
    const session = await loadProjectSession(project, sessionId);
    if (!session) return null;
    return { project, session };
  } catch {
    return null;
  }
}

export async function restoreFromHash(): Promise<ViewState> {
  const hash = window.location.hash.replace(HASH_PREFIX_REGEX, "");
  if (!hash) return { kind: "home" };
  if (hash === "hidden") return { kind: "hidden" };
  if (hash === "settings") return { kind: "settings" };

  const parts = hash.split("/");
  const encodedPath = parts[0];
  const sessionId = parts[1];
  const subAgentId = parts[2] === "subagent" ? parts[3] : undefined;
  if (!encodedPath) return { kind: "home" };

  let project: Project | undefined;
  try {
    project = await loadProject(encodedPath);
  } catch {
    return { kind: "home" };
  }
  if (!project) return { kind: "home" };
  if (!sessionId) return { kind: "project", project };

  if (subAgentId) {
    return { kind: "subagent", project, sessionId, agentId: subAgentId, presenting: false };
  }

  try {
    const session = await loadProjectSession(project, sessionId);
    if (session) {
      return { kind: "session", project, session, presenting: false };
    }
  } catch {
    // fall through
  }
  return { kind: "project", project };
}

export function getHeaderInfo(view: ViewState): { title: string; breadcrumb: string } {
  if (view.kind === "hidden") {
    return { title: "Hidden Projects", breadcrumb: "" };
  }
  if (view.kind === "settings") {
    return { title: "Settings", breadcrumb: "" };
  }
  if (view.kind === "project") {
    const parts = view.project.name.split("/").filter(Boolean);
    return { title: parts.slice(-2).join("/"), breadcrumb: "" };
  }
  if (view.kind === "session") {
    const parts = view.project.name.split("/").filter(Boolean);
    let title = view.session.firstMessage || view.session.slug;
    if (title.length > 60) title = `${title.slice(0, 60)}...`;
    return { title, breadcrumb: parts.slice(-2).join("/") };
  }
  if (view.kind === "subagent") {
    const parts = view.project.name.split("/").filter(Boolean);
    return {
      title: `Sub-agent ${view.agentId.slice(0, 8)}`,
      breadcrumb: parts.slice(-2).join("/"),
    };
  }
  return { title: "Klovi", breadcrumb: "" };
}
