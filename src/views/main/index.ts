import { Electroview } from "electrobun/view";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppGate } from "../../frontend/App.tsx";
import { setRPCClient } from "../../frontend/rpc.ts";
import type { KloviRPC } from "../../shared/rpc-types.ts";

// Import design system globals (tokens, reset, fonts)
import "@cookielab.io/klovi-design-system/globals";

// Import app-specific styles
import "../../frontend/App.css";

const rpc = Electroview.defineRPC<KloviRPC>({
  maxRequestTime: 30_000,
  handlers: {
    requests: {},
    messages: {
      cycleTheme: () => {
        window.dispatchEvent(new CustomEvent("klovi:cycleTheme"));
      },
      increaseFontSize: () => {
        window.dispatchEvent(new CustomEvent("klovi:increaseFontSize"));
      },
      decreaseFontSize: () => {
        window.dispatchEvent(new CustomEvent("klovi:decreaseFontSize"));
      },
      togglePresentation: () => {
        window.dispatchEvent(new CustomEvent("klovi:togglePresentation"));
      },
      openSettings: () => {
        window.dispatchEvent(new CustomEvent("klovi:openSettings"));
      },
    },
  },
});

// Electroview constructor initializes WebSocket transport and wires up the RPC
new Electroview({ rpc });

// Wire up the RPC client so frontend components can use getRPC()
// The `rpc` object from defineRPC has the `.request` proxy that matches our RPCClient interface
setRPCClient(rpc as unknown as import("../../frontend/rpc.ts").RPCClient);

// Mount React app
// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed to exist in index.html
const root = createRoot(document.getElementById("root")!);
root.render(createElement(AppGate));
