import { createContext, useContext } from "react";
import type { KloviClient } from "./client.ts";
import type { KloviHostBridge } from "./host-bridge.ts";

export const KloviClientContext = createContext<KloviClient | null>(null);
export const KloviHostBridgeContext = createContext<KloviHostBridge | null>(null);

export function useKloviClient(): KloviClient {
  const client = useContext(KloviClientContext);
  if (!client) {
    throw new Error("useKloviClient must be used within a KloviClientContext provider");
  }
  return client;
}

export function useKloviHostBridge(): KloviHostBridge {
  const bridge = useContext(KloviHostBridgeContext);
  if (!bridge) {
    throw new Error("useKloviHostBridge must be used within a KloviHostBridgeContext provider");
  }
  return bridge;
}
