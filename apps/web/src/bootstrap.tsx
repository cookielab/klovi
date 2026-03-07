import { createElement } from "react";
import { createRoot } from "react-dom/client";

export interface KloviHostCapabilities {
  desktop: boolean;
  browseDirectory: boolean;
  updater: boolean;
  menuActions: boolean;
}

export interface KloviClient {
  acceptRisks(): Promise<void>;
  isFirstLaunch(): Promise<boolean>;
  getVersion(): Promise<{ version: string; commit: string }>;
  getStats(): Promise<unknown>;
  getProjects(): Promise<unknown>;
  getSessions(projectPath: string): Promise<unknown>;
  getSession(sessionId: string): Promise<unknown>;
  getSubAgent(sessionId: string): Promise<unknown>;
  searchSessions(query: string): Promise<unknown>;
  getPluginSettings(): Promise<unknown>;
  updatePluginSetting(id: string, settings: unknown): Promise<unknown>;
  getGeneralSettings(): Promise<unknown>;
  updateGeneralSettings(settings: unknown): Promise<unknown>;
  resetSettings(): Promise<void>;
}

export interface KloviHostBridge {
  getCapabilities(): KloviHostCapabilities;
  browseDirectory(options: unknown): Promise<unknown>;
  getUpdateSettings(): Promise<unknown>;
  updateUpdateSettings(settings: unknown): Promise<unknown>;
  checkForUpdate(): Promise<void>;
  applyUpdate(): Promise<void>;
  openExternal(url: string): Promise<void>;
  onMenuAction(callback: (action: string) => void): () => void;
  onUpdateStatus(callback: (status: unknown) => void): () => void;
  onManualUpdateResult(callback: (result: unknown) => void): () => void;
}

export interface MountKloviAppConfig {
  container: HTMLElement;
  client: KloviClient;
  hostBridge: KloviHostBridge;
  initialUrl?: string | undefined;
}

function KloviPlaceholder() {
  return createElement("div", { style: { padding: "2rem", fontFamily: "system-ui" } }, "Klovi");
}

export function mountKloviApp(config: MountKloviAppConfig): void {
  const root = createRoot(config.container);
  root.render(createElement(KloviPlaceholder));
}
