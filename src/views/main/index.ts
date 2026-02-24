import { Electroview } from "electrobun/view";
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

const electroview = new Electroview({ rpc });

// Export for use by the RPC client module (src/frontend/rpc.ts, created in Task 8)
export { electroview };

// Mount React app
// Note: App.tsx still auto-mounts itself currently. This will be refactored in Task 8
// when App becomes a named export. For now, just import it to trigger the auto-mount.
import "../../frontend/App.tsx";
