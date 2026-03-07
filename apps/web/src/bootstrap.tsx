import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppGate } from "./app/App.tsx";
import type { KloviClient } from "./lib/client.ts";
import { KloviClientContext, KloviHostBridgeContext } from "./lib/context.ts";
import type { KloviHostBridge } from "./lib/host-bridge.ts";

export { browserHostBridge } from "./lib/browser-host-bridge.ts";
export type { KloviClient } from "./lib/client.ts";
export { useKloviClient, useKloviHostBridge } from "./lib/context.ts";
export type { KloviHostBridge, KloviHostCapabilities } from "./lib/host-bridge.ts";
export { createHttpClient } from "./lib/http-client.ts";

export interface MountKloviAppConfig {
  container: HTMLElement;
  client: KloviClient;
  hostBridge: KloviHostBridge;
  initialUrl?: string | undefined;
}

export function mountKloviApp(config: MountKloviAppConfig): void {
  const root = createRoot(config.container);
  root.render(
    createElement(
      KloviClientContext.Provider,
      { value: config.client },
      createElement(
        KloviHostBridgeContext.Provider,
        { value: config.hostBridge },
        createElement(AppGate),
      ),
    ),
  );
}
