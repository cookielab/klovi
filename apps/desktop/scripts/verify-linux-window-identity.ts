#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const EXPECTED_WM_CLASS = "Klovi";
const FORBIDDEN_WM_CLASS = "ElectrobunKitchenSink";
const PID_REGEX = /_NET_WM_PID\(CARDINAL\)\s*=\s*(\d+)/;
const WM_CLASS_REGEX = /WM_CLASS\([^)]+\)\s*=\s*(.+)/;
const WINDOW_NAME_REGEX = /_NET_WM_NAME\([^)]+\)\s*=\s*"(.+)"/;
const WINDOW_ID_REGEX = /0x[0-9a-f]+/gi;

type VerifyArgs = {
  bundlePath: string;
};

type WindowIdentity = {
  id: string;
  pid: number | null;
  wmClass: string | null;
  name: string | null;
};

export function parseArgs(argv: string[]): VerifyArgs {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
    throw new Error("Usage: bun verify-linux-window-identity.ts <bundle-path>");
  }
  return { bundlePath: args[0] };
}

async function runTextCommand(command: string[]): Promise<string> {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `Command failed: ${command.join(" ")}`);
  }
  return stdout;
}

async function listWindowIds(): Promise<string[]> {
  const stdout = await runTextCommand(["xprop", "-root", "_NET_CLIENT_LIST"]);
  return [...stdout.matchAll(WINDOW_ID_REGEX)].map((match) => match[0]);
}

async function readWindowIdentity(windowId: string): Promise<WindowIdentity> {
  const stdout = await runTextCommand([
    "xprop",
    "-id",
    windowId,
    "_NET_WM_PID",
    "WM_CLASS",
    "_NET_WM_NAME",
  ]);

  const pidMatch = stdout.match(PID_REGEX);
  const wmClassMatch = stdout.match(WM_CLASS_REGEX);
  const nameMatch = stdout.match(WINDOW_NAME_REGEX);

  return {
    id: windowId,
    pid: pidMatch?.[1] ? Number(pidMatch[1]) : null,
    wmClass: wmClassMatch?.[1] ?? null,
    name: nameMatch?.[1] ?? null,
  };
}

async function findWindowForPid(pid: number, timeoutMs = 30_000): Promise<WindowIdentity> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const windowIds = await listWindowIds();
    for (const windowId of windowIds) {
      const identity = await readWindowIdentity(windowId);
      if (identity.pid === pid) {
        return identity;
      }
    }
    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for a window owned by pid ${pid}`);
}

async function resolveLauncherPath(bundlePath: string): Promise<string> {
  const resolvedBundle = resolve(bundlePath);
  const bundleLauncher = join(resolvedBundle, "bin", "launcher");
  if (await Bun.file(bundleLauncher).exists()) {
    return bundleLauncher;
  }

  const appDirLauncher = join(resolvedBundle, "usr", "lib", "klovi", "bin", "launcher");
  if (await Bun.file(appDirLauncher).exists()) {
    return appDirLauncher;
  }

  throw new Error(`Could not find launcher under ${resolvedBundle}`);
}

function killProcess(proc: Bun.Subprocess): Promise<void> {
  return new Promise((resolvePromise) => {
    const finish = () => resolvePromise();
    if (proc.exitCode !== null) {
      finish();
      return;
    }
    proc.exited.then(() => finish()).catch(() => finish());
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill("SIGKILL");
      }
    }, 5_000);
  });
}

export async function verifyLinuxWindowIdentity(args: VerifyArgs): Promise<void> {
  if (!Bun.env["DISPLAY"]) {
    throw new Error("DISPLAY is not set. Run this script under xvfb-run or an X11 session.");
  }

  const launcherPath = await resolveLauncherPath(args.bundlePath);
  const tempHome = await mkdtemp(join(tmpdir(), "klovi-linux-window-"));
  const settingsPath = join(tempHome, "settings.json");
  const bundleDir = dirname(launcherPath);
  const proc = Bun.spawn([launcherPath], {
    cwd: bundleDir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...Bun.env,
      HOME: tempHome,
      KLOVI_SETTINGS_PATH: settingsPath,
    },
  });

  try {
    const pid = proc.pid;
    if (pid == null) {
      throw new Error("Failed to start launcher process");
    }

    const identity = await findWindowForPid(pid);
    const wmClass = identity.wmClass ?? "";
    const name = identity.name ?? "";

    if (wmClass.includes(FORBIDDEN_WM_CLASS)) {
      throw new Error(`Unexpected WM_CLASS for Klovi window: ${wmClass}`);
    }
    if (!wmClass.includes(EXPECTED_WM_CLASS)) {
      throw new Error(`WM_CLASS does not contain ${EXPECTED_WM_CLASS}: ${wmClass}`);
    }
    if (name !== "" && !name.includes(EXPECTED_WM_CLASS)) {
      throw new Error(`Window title does not contain ${EXPECTED_WM_CLASS}: ${name}`);
    }

    console.log(`Verified Linux window identity: ${wmClass}${name ? ` (${name})` : ""}`);
  } finally {
    await killProcess(proc);
    await rm(tempHome, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    await verifyLinuxWindowIdentity(parseArgs(Bun.argv));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
