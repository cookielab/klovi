import type { RPCSchema } from "electrobun/bun";

export type UpdateChannel = "stable" | "candidate" | "beta";

export type UpdateSettingsInfo = {
  channel: UpdateChannel;
  checkIntervalHours: number;
  autoDownload: boolean;
};

export type UpdateStatus = {
  status: "up-to-date" | "available" | "downloading" | "ready" | "error";
  currentVersion: string;
  latestVersion?: string;
  progress?: number;
  error?: string;
};

// Desktop RPC carries only native host bridge methods — no server-backed data methods.
export interface KloviRPC {
  bun: RPCSchema<{
    requests: {
      browseDirectory: {
        params: { startingFolder?: string };
        response: { path: string | null };
      };
      getUpdateSettings: {
        params: Record<string, never>;
        response: UpdateSettingsInfo;
      };
      updateUpdateSettings: {
        params: { channel?: UpdateChannel; checkIntervalHours?: number; autoDownload?: boolean };
        response: UpdateSettingsInfo;
      };
      checkForUpdate: {
        params: Record<string, never>;
        response: UpdateStatus;
      };
      applyUpdate: {
        params: Record<string, never>;
        response: { ok: boolean; error?: string };
      };
      openExternal: { params: { url: string }; response: { ok: boolean } };
      getServerUrl: { params: Record<string, never>; response: { url: string } };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      cycleTheme: Record<string, never>;
      increaseFontSize: Record<string, never>;
      decreaseFontSize: Record<string, never>;
      togglePresentation: Record<string, never>;
      openSettings: Record<string, never>;
      updateStatus: UpdateStatus;
      checkForUpdatesResult: UpdateStatus;
    };
  }>;
}
