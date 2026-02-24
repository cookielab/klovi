import { Electroview } from "electrobun/view";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppGate } from "../../frontend/App.tsx";
import { setRPCClient } from "../../frontend/rpc.ts";
import type { KloviRPC } from "../../shared/rpc-types.ts";

// Import fonts
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

// Import styles
import "../../frontend/index.css";
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
    },
  },
});

// Electroview constructor initializes WebSocket transport and wires up the RPC
new Electroview({ rpc });

// Wire up the RPC client so frontend components can use getRPC()
// The `rpc` object from defineRPC has the `.request` proxy that matches our RPCClient interface
setRPCClient(rpc as unknown as import("../../frontend/rpc.ts").RPCClient);

// Mount React app
const root = createRoot(document.getElementById("root")!);
root.render(createElement(AppGate));
