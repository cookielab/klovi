import "@cookielab.io/klovi-design-system/globals";
import { mountKloviApp } from "./bootstrap";
import { browserHostBridge } from "./lib/browser-host-bridge";
import { createHttpClient } from "./lib/http-client";

const baseUrl = globalThis.location.origin;
const client = createHttpClient(baseUrl);

const container = document.querySelector<HTMLElement>("#root");
if (!container) {
	throw new Error("Root element #root not found in DOM");
}

mountKloviApp({
	container: container,
	client: client,
	hostBridge: browserHostBridge,
});
