import { parseSessionId } from "@cookielab.io/klovi-plugin-core";
import { Effect } from "effect";
import type { KloviClient } from "../lib/client.ts";
import { kloviClient } from "../lib/rpc-client.ts";
import { isRpcTransportError } from "../lib/rpc-errors.ts";
import { isTransportRpcError } from "../lib/rpc-errors-effect.ts";
import type { Project, SessionSummary } from "../shared/types.ts";
import { getFrontendPlugin } from "./plugin-registry.ts";

const HASH_PREFIX_REGEX = /^#\/?/u;

type ViewState =
	| { kind: "home" }
	| { kind: "hidden" }
	| { kind: "settings" }
	| { kind: "restoring"; hash: string }
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

function getResumeCommand(pluginId: string | undefined, encodedSessionId: string): string | undefined {
	const parsedSessionId = parseSessionId(encodedSessionId);
	const resolvedPluginId = pluginId ?? parsedSessionId.pluginId ?? undefined;
	if (!(resolvedPluginId && parsedSessionId.rawSessionId)) {
		return;
	}
	return getFrontendPlugin(resolvedPluginId)?.getResumeCommand?.(parsedSessionId.rawSessionId) ?? undefined;
}

function viewToHash(view: ViewState): string {
	if (view.kind === "hidden") {
		return "#/hidden";
	}
	if (view.kind === "settings") {
		return "#/settings";
	}
	if (view.kind === "restoring") {
		return view.hash;
	}
	if (view.kind === "project") {
		return `#/${view.project.encodedPath}`;
	}
	if (view.kind === "session") {
		return `#/${view.project.encodedPath}/${view.session.sessionId}`;
	}
	if (view.kind === "subagent") {
		return `#/${view.project.encodedPath}/${view.sessionId}/subagent/${view.agentId}`;
	}
	return "#/";
}

function createRestoringView(): ViewState {
	return { kind: "restoring", hash: globalThis.location.hash || "#/" };
}

async function loadProject(client: KloviClient, encodedPath: string): Promise<Project | undefined> {
	const data = await client.getProjects();
	return data.projects.find((p) => p.encodedPath === encodedPath);
}

async function loadProjectSession(
	client: KloviClient,
	project: Project,
	sessionId: string,
): Promise<SessionSummary | undefined> {
	const data = await client.getSessions({ encodedPath: project.encodedPath });
	return data.sessions.find((s) => s.sessionId === sessionId);
}

async function resolveProjectAndSession(
	client: KloviClient,
	encodedPath: string,
	sessionId: string,
): Promise<{ project: Project; session: SessionSummary } | null> {
	try {
		const project = await loadProject(client, encodedPath);
		if (!project) {
			return null;
		}
		const session = await loadProjectSession(client, project, sessionId);
		if (!session) {
			return null;
		}
		return { project: project, session: session };
	} catch {
		return null;
	}
}

const loadProjectEffect = (encodedPath: string) =>
	kloviClient
		.getProjects()
		.pipe(Effect.map((data) => data.projects.find((project) => project.encodedPath === encodedPath)));

const loadProjectSessionEffect = (project: Project, sessionId: string) =>
	kloviClient
		.getSessions({ encodedPath: project.encodedPath })
		.pipe(Effect.map((data) => data.sessions.find((session) => session.sessionId === sessionId)));

const resolveProjectAndSessionEffect = (encodedPath: string, sessionId: string) =>
	Effect.gen(function* () {
		const project = yield* loadProjectEffect(encodedPath);
		if (!project) {
			return null;
		}

		const session = yield* loadProjectSessionEffect(project, sessionId);
		if (!session) {
			return null;
		}

		return { project: project, session: session };
	}).pipe(Effect.catchAll(() => Effect.succeed(null)));

function parseHashToStaticView(hash: string): ViewState | null {
	if (!hash) {
		return { kind: "home" };
	}
	if (hash === "hidden") {
		return { kind: "hidden" };
	}
	if (hash === "settings") {
		return { kind: "settings" };
	}
	return null;
}

function resolveSessionViewEffect(project: Project, sessionId: string) {
	return Effect.gen(function* () {
		const sessionResult = yield* Effect.either(loadProjectSessionEffect(project, sessionId));
		if (sessionResult._tag === "Left") {
			return isTransportRpcError(sessionResult.left)
				? createRestoringView()
				: ({ kind: "project", project: project } as ViewState);
		}

		return sessionResult.right
			? ({ kind: "session", project: project, session: sessionResult.right, presenting: false } as ViewState)
			: ({ kind: "project", project: project } as ViewState);
	});
}

function resolveProjectViewEffect(encodedPath: string, sessionId: string | undefined, subAgentId: string | undefined) {
	return Effect.gen(function* () {
		const projectResult = yield* Effect.either(loadProjectEffect(encodedPath));
		if (projectResult._tag === "Left") {
			return isTransportRpcError(projectResult.left) ? createRestoringView() : ({ kind: "home" } as ViewState);
		}

		const project = projectResult.right;
		if (!project) {
			return { kind: "home" } as ViewState;
		}
		if (!sessionId) {
			return { kind: "project", project: project } as ViewState;
		}

		if (subAgentId) {
			return {
				kind: "subagent",
				project: project,
				sessionId: sessionId,
				agentId: subAgentId,
				presenting: false,
			} as ViewState;
		}

		return yield* resolveSessionViewEffect(project, sessionId);
	});
}

const restoreFromHashEffect = () =>
	Effect.gen(function* () {
		const hash = globalThis.location.hash.replace(HASH_PREFIX_REGEX, "");
		const staticView = parseHashToStaticView(hash);
		if (staticView) {
			return staticView;
		}

		const parts = hash.split("/");
		const [encodedPath, sessionId] = parts;
		const subAgentId = parts[2] === "subagent" ? parts[3] : undefined;
		if (!encodedPath) {
			return { kind: "home" } as ViewState;
		}

		return yield* resolveProjectViewEffect(encodedPath, sessionId, subAgentId);
	});

async function restoreFromHash(client: KloviClient): Promise<ViewState> {
	const hash = globalThis.location.hash.replace(HASH_PREFIX_REGEX, "");
	if (!hash) {
		return { kind: "home" };
	}
	if (hash === "hidden") {
		return { kind: "hidden" };
	}
	if (hash === "settings") {
		return { kind: "settings" };
	}

	const parts = hash.split("/");
	const [encodedPath, sessionId] = parts;
	const subAgentId = parts[2] === "subagent" ? parts[3] : undefined;
	if (!encodedPath) {
		return { kind: "home" };
	}

	let project: Project | undefined;
	try {
		project = await loadProject(client, encodedPath);
	} catch (error) {
		if (isRpcTransportError(error)) {
			return createRestoringView();
		}
		return { kind: "home" };
	}
	if (!project) {
		return { kind: "home" };
	}
	if (!sessionId) {
		return { kind: "project", project: project };
	}

	if (subAgentId) {
		return { kind: "subagent", project: project, sessionId: sessionId, agentId: subAgentId, presenting: false };
	}

	try {
		const session = await loadProjectSession(client, project, sessionId);
		if (session) {
			return { kind: "session", project: project, session: session, presenting: false };
		}
	} catch (error) {
		if (isRpcTransportError(error)) {
			return createRestoringView();
		}
	}
	return { kind: "project", project: project };
}

function getHeaderInfo(view: ViewState): { title: string; breadcrumb: string } {
	if (view.kind === "hidden") {
		return { title: "Hidden Projects", breadcrumb: "" };
	}
	if (view.kind === "settings") {
		return { title: "Settings", breadcrumb: "" };
	}
	if (view.kind === "restoring") {
		return { title: "Klovi", breadcrumb: "" };
	}
	if (view.kind === "project") {
		const parts = view.project.name.split("/").filter(Boolean);
		return { title: parts.slice(-2).join("/"), breadcrumb: "" };
	}
	if (view.kind === "session") {
		const parts = view.project.name.split("/").filter(Boolean);
		let title = view.session.firstMessage || view.session.slug;
		if (title.length > 60) {
			title = `${title.slice(0, 60)}...`;
		}
		return { title: title, breadcrumb: parts.slice(-2).join("/") };
	}
	if (view.kind === "subagent") {
		const parts = view.project.name.split("/").filter(Boolean);
		const agentIdPrefixLength = 8;
		return {
			title: `Sub-agent ${view.agentId.slice(0, agentIdPrefixLength)}`,
			breadcrumb: parts.slice(-2).join("/"),
		};
	}
	return { title: "Klovi", breadcrumb: "" };
}

export type { ViewState };
export {
	getHeaderInfo,
	getResumeCommand,
	resolveProjectAndSession,
	resolveProjectAndSessionEffect,
	restoreFromHash,
	restoreFromHashEffect,
	viewToHash,
};
