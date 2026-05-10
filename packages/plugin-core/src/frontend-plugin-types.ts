export type FrontendPlugin = {
	id: string;
	displayName: string;
	getResumeCommand?: (sessionId: string) => string | null;
};
