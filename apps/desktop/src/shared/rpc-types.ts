import type { DesktopRequestMap, DesktopWebviewMessageMap } from "@cookielab.io/klovi-ui/shared/desktop-contract";
import type { RPCSchema } from "electrobun/bun";

type KloviRPC = {
	bun: RPCSchema<{
		requests: DesktopRequestMap;
		messages: Record<string, never>;
	}>;
	webview: RPCSchema<{
		requests: Record<string, never>;
		messages: DesktopWebviewMessageMap;
	}>;
};

export type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "@cookielab.io/klovi-ui/shared/rpc-types";
export type { KloviRPC };
