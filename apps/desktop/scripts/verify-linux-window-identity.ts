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
const WHITESPACE_REGEX = /\s+/;

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

export function parsePidList(stdout: string): number[] {
  return stdout
    .split(WHITESPACE_REGEX)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
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

async function listChildPids(pid: number): Promise<number[]> {
  const stdout = await runTextCommand(["ps", "-o", "pid=", "--ppid", String(pid)]);
  return parsePidList(stdout);
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

async function listProcessFamily(rootPid: number): Promise<Set<number>> {
  const pending = [rootPid];
  const seen = new Set<number>();

  while (pending.length > 0) {
    const pid = pending.shift();
    if (pid == null || seen.has(pid)) {
      continue;
    }

    seen.add(pid);

    for (const childPid of await listChildPids(pid)) {
      if (!seen.has(childPid)) {
        pending.push(childPid);
      }
    }
  }

  return seen;
}

function matchesExpectedWindow(identity: WindowIdentity): boolean {
  const wmClass = identity.wmClass ?? "";
  const name = identity.name ?? "";

  if (wmClass.includes(FORBIDDEN_WM_CLASS)) {
    return false;
  }
  if (!wmClass.includes(EXPECTED_WM_CLASS)) {
    return false;
  }
  if (name !== "" && !name.includes(EXPECTED_WM_CLASS)) {
    return false;
  }

  return true;
}

export function selectWindowCandidate(
  identities: WindowIdentity[],
  ownerPids: Set<number>,
  existingWindowIds: Set<string>,
): WindowIdentity | null {
  for (const identity of identities) {
    if (identity.pid !== null && ownerPids.has(identity.pid) && matchesExpectedWindow(identity)) {
      return identity;
    }
  }

  for (const identity of identities) {
    if (!existingWindowIds.has(identity.id) && matchesExpectedWindow(identity)) {
      return identity;
    }
  }

  return null;
}

function formatWindowIdentity(identity: WindowIdentity): string {
  return [
    identity.id,
    `pid=${identity.pid ?? "?"}`,
    `wmClass=${identity.wmClass ?? "(missing)"}`,
    `name=${identity.name ?? "(missing)"}`,
  ].join(" ");
}

async function findWindowForLaunch(rootPid: number, timeoutMs = 30_000): Promise<WindowIdentity> {
  const existingWindowIds = new Set(await listWindowIds());
  let lastObservedWindows: WindowIdentity[] = [];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const windowIds = await listWindowIds();
    const identities = await Promise.all(windowIds.map((windowId) => readWindowIdentity(windowId)));
    const ownerPids = await listProcessFamily(rootPid);
    const match = selectWindowCandidate(identities, ownerPids, existingWindowIds);

    lastObservedWindows = identities;

    if (match) {
      return match;
    }

    await Bun.sleep(500);
  }

  const summary =
    lastObservedWindows.length > 0
      ? lastObservedWindows.map((identity) => formatWindowIdentity(identity)).join("; ")
      : "(no windows found)";

  throw new Error(
    `Timed out waiting for a Klovi window after launching pid ${rootPid}. ${summary}`,
  );
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

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killProcessTree(rootPid: number): Promise<void> {
  const pids = [...(await listProcessFamily(rootPid))].sort((left, right) => right - left);

  for (const pid of pids) {
    if (processExists(pid)) {
      process.kill(pid, "SIGTERM");
    }
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!pids.some((pid) => processExists(pid))) {
      return;
    }
    await Bun.sleep(100);
  }

  for (const pid of pids) {
    if (processExists(pid)) {
      process.kill(pid, "SIGKILL");
    }
  }
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

    const identity = await findWindowForLaunch(pid);
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
    if (proc.pid != null) {
      await killProcessTree(proc.pid);
    }
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
