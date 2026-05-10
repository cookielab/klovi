import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";

export const codexFrontendPlugin: FrontendPlugin = {
	id: "codex-cli",
	displayName: "Codex",
	getResumeCommand: (sessionId: string) => `codex resume ${sessionId}`,
};
