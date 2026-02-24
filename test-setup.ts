import { GlobalWindow } from "happy-dom";
import { setupMockRPC } from "./src/frontend/test-helpers/mock-rpc.ts";

const window = new GlobalWindow();

// Register DOM globals
const globals = [
  "document",
  "window",
  "HTMLElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "CustomEvent",
  "MutationObserver",
  "navigator",
  "location",
  "getComputedStyle",
  "localStorage",
] as const;

for (const key of globals) {
  if (key in window) {
    (globalThis as Record<string, unknown>)[key] = (window as unknown as Record<string, unknown>)[
      key
    ];
  }
}

// Set up default RPC mock for all tests
setupMockRPC();
