import type { UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../shared/rpc-types.ts";

export interface KloviHostCapabilities {
  desktop: boolean;
  browseDirectory: boolean;
  updater: boolean;
  menuActions: boolean;
}

export type KloviHostConnectionState = "connecting" | "connected" | "disconnected";

export interface KloviHostBridge {
  getCapabilities(): KloviHostCapabilities;
  getConnectionState(): KloviHostConnectionState;
  browseDirectory(params: { startingFolder?: string }): Promise<{ path: string | null }>;
  getUpdateSettings(): Promise<UpdateSettingsInfo>;
  updateUpdateSettings(params: {
    channel?: UpdateChannel;
    checkIntervalHours?: number;
    autoDownload?: boolean;
  }): Promise<UpdateSettingsInfo>;
  checkForUpdate(): Promise<UpdateStatus>;
  applyUpdate(): Promise<{ ok: boolean; error?: string }>;
  openExternal(params: { url: string }): Promise<{ ok: boolean }>;
  onMenuAction(
    callback: (
      action:
        | "cycleTheme"
        | "increaseFontSize"
        | "decreaseFontSize"
        | "togglePresentation"
        | "openSettings",
    ) => void,
  ): () => void;
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void;
  onManualUpdateResult(callback: (result: UpdateStatus) => void): () => void;
  onConnectionState(callback: (state: KloviHostConnectionState) => void): () => void;
  getSystemTheme(): Promise<{ theme: "dark" | "light" | null }>;
  onSystemThemeChange(callback: (theme: "dark" | "light") => void): () => void;
}
