import "@cookielab.io/klovi-design-system/globals";
import { mountKloviApp } from "./bootstrap.tsx";
import { browserHostBridge } from "./lib/browser-host-bridge.ts";
import { createHttpClient } from "./lib/http-client.ts";

const baseUrl = globalThis.location.origin;
const client = createHttpClient(baseUrl);

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.querySelector<HTMLElement>("#root")!;

mountKloviApp({
	container: container,
	client: client,
	hostBridge: browserHostBridge,
});
