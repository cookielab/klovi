import type { PluginProject, SessionSummary } from "@cookielab.io/klovi-plugin-core";

type CursorSessionType = SessionSummary["sessionType"];

type CursorBaseSessionRecord = {
	kind: "composer" | "agent" | "plan";
	rawSessionId: string;
	projectPath: string;
	timestamp: string;
	firstMessage: string;
	slug: string;
	model: string;
	gitBranch: string;
	sessionType?: CursorSessionType;
};

export type CursorComposerSummary = CursorBaseSessionRecord & {
	kind: "composer";
	composerId: string;
	workspaceDbPath: string;
	createdAtMs: number;
	lastUpdatedAtMs: number;
	name: string;
	subtitle: string;
	unifiedMode: string;
};

export type CursorAgentSummary = CursorBaseSessionRecord & {
	kind: "agent";
	agentId: string;
	filePath: string;
	timestampMs: number;
};

export type CursorPlanSummary = CursorBaseSessionRecord & {
	kind: "plan";
	planId: string;
	filePath: string;
	createdAtMs: number;
	lastUpdatedAtMs: number;
	createdBy: string;
};

export type CursorSessionRecord = CursorComposerSummary | CursorAgentSummary | CursorPlanSummary;

export type CursorIndex = {
	projects: PluginProject[];
	sessionsByProject: Map<string, CursorSessionRecord[]>;
	composersById: Map<string, CursorComposerSummary>;
	agentsById: Map<string, CursorAgentSummary>;
	plansById: Map<string, CursorPlanSummary>;
};
