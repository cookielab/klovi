import type { DesktopRequestMap, DesktopWebviewMessageMap } from "@cookielab.io/klovi-ui/shared/desktop-contract";
import type { RpcSchema } from "electrobun/bun";

type KloviRPC = {
	bun: RpcSchema<{
		requests: DesktopRequestMap;
		messages: Record<string, never>;
	}>;
	webview: RpcSchema<{
		requests: Record<string, never>;
		messages: DesktopWebviewMessageMap;
	}>;
};

export type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "@cookielab.io/klovi-ui/shared/rpc-types";
export type { KloviRPC };
