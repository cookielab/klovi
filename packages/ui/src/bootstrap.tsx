import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppGate } from "./app/App.tsx";
import type { KloviClient } from "./lib/client.ts";
import { KloviRuntimeProvider } from "./lib/context.ts";
import type { KloviHostBridge } from "./lib/host-bridge.ts";

export { browserHostBridge } from "./lib/browser-host-bridge.ts";
export type { KloviClient } from "./lib/client.ts";
export type {
	KloviHostBridge,
	KloviHostCapabilities,
	KloviHostConnectionState,
} from "./lib/host-bridge.ts";
export { createHttpClient } from "./lib/http-client.ts";
export {
	createRpcDisconnectedError,
	createRpcTimeoutError,
	getRpcErrorCode,
	isRpcTimeoutError,
	isRpcTransportError,
} from "./lib/rpc-errors.ts";
export type {
	DashboardStats,
	GlobalSessionResult,
	Project,
	Session,
	SessionSummary,
} from "./shared/types.ts";

export type MountKloviAppConfig = {
	container: HTMLElement;
	client: KloviClient;
	hostBridge: KloviHostBridge;
};

export function mountKloviApp(config: MountKloviAppConfig): void {
	const root = createRoot(config.container);
	root.render(
		createElement(
			KloviRuntimeProvider,
			{ client: config.client, hostBridge: config.hostBridge },
			createElement(AppGate),
		),
	);
}
