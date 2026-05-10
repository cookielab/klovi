import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { openCodeInputFormatters, openCodeSummaryExtractors } from "../extractors";

export const openCodeFrontendPlugin: FrontendPlugin = {
	id: "opencode",
	displayName: "OpenCode",
	summaryExtractors: openCodeSummaryExtractors,
	inputFormatters: openCodeInputFormatters,
};
