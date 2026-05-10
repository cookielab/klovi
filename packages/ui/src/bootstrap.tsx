import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppGate } from "./app/App";
import type { KloviClient } from "./lib/client";
import { KloviRuntimeProvider } from "./lib/context";
import type { KloviHostBridge } from "./lib/host-bridge";

export { browserHostBridge } from "./lib/browser-host-bridge";
export type { KloviClient } from "./lib/client";
export type {
	KloviHostBridge,
	KloviHostCapabilities,
	KloviHostConnectionState,
} from "./lib/host-bridge";
export { createHttpClient } from "./lib/http-client";
export {
	createRpcDisconnectedError,
	createRpcTimeoutError,
	getRpcErrorCode,
	isRpcTimeoutError,
	isRpcTransportError,
} from "./lib/rpc-errors";
export type {
	DashboardStats,
	GlobalSessionResult,
	Project,
	Session,
	SessionSummary,
} from "./shared/types";

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
