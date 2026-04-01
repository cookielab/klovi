import "@cookielab.io/klovi-design-system/globals";
import "./app/App.css";
import { mountKloviApp } from "./bootstrap.tsx";
import { browserHostBridge } from "./lib/browser-host-bridge.ts";
import { createHttpClient } from "./lib/http-client.ts";

const baseUrl = window.location.origin;
const client = createHttpClient(baseUrl);

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const container = document.getElementById("root")!;

mountKloviApp({
	container: container,
	client: client,
	hostBridge: browserHostBridge,
});
