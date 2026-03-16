#!/usr/bin/env bun

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const desktopRoot = resolve(import.meta.dir, "..");
const electrobunDir = join(desktopRoot, "node_modules", "electrobun");
const cliEntrypoint = join(electrobunDir, "src", "cli", "index.ts");

const shims: Record<string, string> = {
  "src/shared/platform.ts": `import { platform, arch } from "os";

export type SupportedOS = "macos" | "win" | "linux";
export type SupportedArch = "arm64" | "x64";

const platformName = platform();
const archName = arch();

export const OS: SupportedOS = (() => {
  switch (platformName) {
    case "win32":
      return "win";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      throw new Error(\`Unsupported platform: \${platformName}\`);
  }
})();

export const ARCH: SupportedArch = (() => {
  if (OS === "win") {
    return "x64";
  }

  switch (archName) {
    case "arm64":
      return "arm64";
    case "x64":
      return "x64";
    default:
      throw new Error(\`Unsupported architecture: \${archName}\`);
  }
})();

export function getPlatformOS(): SupportedOS {
  return OS;
}

export function getPlatformArch(): SupportedArch {
  return ARCH;
}
`,
  "src/shared/naming.ts": `import type { SupportedOS, SupportedArch } from "./platform";

export type BuildEnvironment = "stable" | "canary" | "dev" | (string & {});

export function sanitizeAppName(appName: string): string {
  return appName.replace(/ /g, "");
}

export function getAppFileName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  const sanitized = sanitizeAppName(appName);
  return buildEnvironment === "stable"
    ? sanitized
    : \`\${sanitized}-\${buildEnvironment}\`;
}

export function getMacOSBundleDisplayName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  return buildEnvironment === "stable"
    ? appName
    : \`\${appName}-\${buildEnvironment}\`;
}

export function getBundleFileName(
  appName: string,
  buildEnvironment: BuildEnvironment,
  os: SupportedOS,
): string {
  const appFileName = getAppFileName(appName, buildEnvironment);
  return os === "macos" ? \`\${appFileName}.app\` : appFileName;
}

export function getPlatformPrefix(
  buildEnvironment: BuildEnvironment,
  os: SupportedOS,
  arch: SupportedArch,
): string {
  return \`\${buildEnvironment}-\${os}-\${arch}\`;
}

export function getTarballFileName(
  appFileName: string,
  os: SupportedOS,
): string {
  return os === "macos" ? \`\${appFileName}.app.tar.zst\` : \`\${appFileName}.tar.zst\`;
}

export function getWindowsSetupFileName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  return buildEnvironment === "stable"
    ? \`\${appName}-Setup.exe\`
    : \`\${appName}-Setup-\${buildEnvironment}.exe\`;
}

export function getLinuxAppImageBaseName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  return buildEnvironment === "stable"
    ? \`\${appName}-Setup\`
    : \`\${appName}-Setup-\${buildEnvironment}\`;
}

export function getLinuxAppImageFileName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  return \`\${getLinuxAppImageBaseName(appName, buildEnvironment)}.AppImage\`;
}

export function sanitizeVolumeNameForHdiutil(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
}

export function getDmgVolumeName(
  appName: string,
  buildEnvironment: BuildEnvironment,
): string {
  const baseName = sanitizeVolumeNameForHdiutil(appName);
  return buildEnvironment === "stable" ? baseName : \`\${baseName}-\${buildEnvironment}\`;
}

export function getUpdateInfoUrl(baseUrl: string, platformPrefix: string): string {
  return \`\${baseUrl.replace(/\\/+$/, "")}/\${platformPrefix}-update.json\`;
}

export function getPatchFileUrl(
  baseUrl: string,
  platformPrefix: string,
  hash: string,
): string {
  return \`\${baseUrl.replace(/\\/+$/, "")}/\${platformPrefix}-\${hash}.patch\`;
}

export function getTarballUrl(
  baseUrl: string,
  platformPrefix: string,
  tarballFileName: string,
): string {
  return \`\${baseUrl.replace(/\\/+$/, "")}/\${platformPrefix}-\${tarballFileName}\`;
}
`,
  "src/shared/bun-version.ts": `export const BUN_VERSION = "1.3.9";
`,
  "src/shared/electrobun-version.ts": `import { version } from "../../package.json";

export const ELECTROBUN_VERSION: string = version;
`,
  "src/shared/cef-version.ts": `export const CEF_VERSION = \`145.0.23+g3e7fe1c\`;
export const CHROMIUM_VERSION = \`145.0.7632.68\`;
export const DEFAULT_CEF_VERSION_STRING = \`\${CEF_VERSION}+chromium-\${CHROMIUM_VERSION}\`;
`,
  "src/cli/templates/embedded.ts": `type TemplateEntry = {
  name: string;
  files: Record<string, string>;
};

const templates = new Map<string, TemplateEntry>();

export function getTemplateNames(): string[] {
  return [...templates.keys()];
}

export function getTemplate(name: string): TemplateEntry {
  const template = templates.get(name);
  if (!template) {
    throw new Error(\`Unknown template: \${name}\`);
  }
  return template;
}
`,
};

async function ensureShims(): Promise<void> {
  for (const [relativePath, contents] of Object.entries(shims)) {
    const fullPath = join(electrobunDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    const file = Bun.file(fullPath);
    const current = (await file.exists()) ? await file.text() : null;
    if (current !== contents) {
      await Bun.write(fullPath, contents);
    }
  }
}

async function main(): Promise<void> {
  const cliArgs = Bun.argv.slice(2);
  if (cliArgs.length === 0) {
    throw new Error("Usage: bun run-electrobun-cli.ts <command> [...args]");
  }

  await ensureShims();

  const proc = Bun.spawn([process.execPath, cliEntrypoint, ...cliArgs], {
    cwd: desktopRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  process.exit(exitCode);
}

await main();
