import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type BrowserRenderer = "native" | "cef";

interface DesktopRuntimePaths {
  userData: string;
  userCache: string;
  userLogs: string;
}

export function resolveLinuxRenderer(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = Bun.env,
): BrowserRenderer | undefined {
  if (platform !== "linux") {
    return;
  }

  return env["KLOVI_LINUX_RENDERER"] === "cef" ? "cef" : "native";
}

export function getDesktopRuntimeDirs(paths: DesktopRuntimePaths): string[] {
  const cefDir = join(paths.userCache, "CEF");
  const partitionsDir = join(cefDir, "Partitions");

  return [
    paths.userData,
    paths.userCache,
    paths.userLogs,
    cefDir,
    partitionsDir,
    join(partitionsDir, "default"),
  ];
}

export function ensureDesktopRuntimeDirs(paths: DesktopRuntimePaths): void {
  for (const dir of getDesktopRuntimeDirs(paths)) {
    mkdirSync(dir, { recursive: true });
  }
}
