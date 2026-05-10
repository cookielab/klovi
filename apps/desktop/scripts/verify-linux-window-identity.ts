#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { resolveLinuxLauncherPath } from "./linux-bundle";


const N_30000 = 30_000;
const N_500 = 500;
const N_5000 = 5000;
const N_100 = 100;

const EXPECTED_WM_CLASS = "Klovi";
const FORBIDDEN_WM_CLASS = "ElectrobunKitchenSink";
const PID_REGEX = /_NET_WM_PID\(CARDINAL\)\s*=\s*(?<pid>\d+)/u;
const WM_CLASS_REGEX = /WM_CLASS\([^)]+\)\s*=\s*(?<wmclass>.+)/u;
const WINDOW_NAME_REGEX = /_NET_WM_NAME\([^)]+\)\s*=\s*"(?<name>.+)"/u;
const WINDOW_ID_REGEX = /0x[0-9a-f]+/giu;
const WHITESPACE_REGEX = /\s+/u;
const OUTPUT_TAIL_LINE_COUNT = 20;

type VerifyArgs = {
	bundlePath: string;
};

type WindowIdentity = {
	id: string;
	pid: number | null;
	wmClass: string | null;
	name: string | null;
};

type LaunchFailureDetails = {
	lastObservedWindows: WindowIdentity[];
	launchExitCode: number | null;
	launchStderr: string;
	launchStdout: string;
	rootPid: number;
};

function parseArgs(argv: string[]): VerifyArgs {
	const args = argv.slice(2);
	if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
		throw new Error("Usage: bun verify-linux-window-identity.ts <bundle-path>");
	}
	return { bundlePath: args[0] };
}

function parsePidList(stdout: string): number[] {
	return stdout
		.split(WHITESPACE_REGEX)
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isInteger(value) && value > 0);
}

async function runTextCommand(command: string[], allowedExitCodes: number[] = [0]): Promise<string> {
	const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	if (!allowedExitCodes.includes(exitCode)) {
		throw new Error(stderr.trim() || `Command failed: ${command.join(" ")}`);
	}
	return stdout;
}

async function listWindowIds(): Promise<string[]> {
	const stdout = await runTextCommand(["xprop", "-root", "_NET_CLIENT_LIST"]);
	return [...stdout.matchAll(WINDOW_ID_REGEX)].map((match) => match[0]);
}

async function listChildPids(pid: number): Promise<number[]> {
	const stdout = await runTextCommand(["ps", "-o", "pid=", "--ppid", String(pid)], [0, 1]);
	return parsePidList(stdout);
}

async function readWindowIdentity(windowId: string): Promise<WindowIdentity> {
	const stdout = await runTextCommand(["xprop", "-id", windowId, "_NET_WM_PID", "WM_CLASS", "_NET_WM_NAME"]);

	const pidMatch = stdout.match(PID_REGEX);
	const wmClassMatch = stdout.match(WM_CLASS_REGEX);
	const nameMatch = stdout.match(WINDOW_NAME_REGEX);

	return {
		id: windowId,
		pid: pidMatch?.groups?.["pid"] ? Number(pidMatch.groups["pid"]) : null,
		wmClass: wmClassMatch?.groups?.["wmclass"] ?? null,
		name: nameMatch?.groups?.["name"] ?? null,
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

function selectWindowCandidate(
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

function formatOutputTail(label: string, output: string): string | null {
	const trimmed = output.trim();
	if (trimmed === "") {
		return null;
	}

	const lines = trimmed.split("\n");
	const tail = lines.slice(-OUTPUT_TAIL_LINE_COUNT);
	return `${label}:\n${tail.join("\n")}`;
}

function formatLaunchFailure(details: LaunchFailureDetails): string {
	const summary =
		details.lastObservedWindows.length > 0
			? details.lastObservedWindows.map((identity) => formatWindowIdentity(identity)).join("; ")
			: "(no windows found)";

	const lines = [`Timed out waiting for a Klovi window after launching pid ${details.rootPid}. ${summary}`];
	if (details.launchExitCode !== null) {
		lines.push(`Launcher exited before a matching window appeared (exit code ${details.launchExitCode}).`);
		const stderrTail = formatOutputTail("Launcher stderr tail", details.launchStderr);
		if (stderrTail) {
			lines.push(stderrTail);
		}
		const stdoutTail = formatOutputTail("Launcher stdout tail", details.launchStdout);
		if (stdoutTail) {
			lines.push(stdoutTail);
		}
	}

	return lines.join("\n");
}

class WindowSearchTimeoutError extends Error {
	public readonly lastObservedWindows: WindowIdentity[];
	public readonly rootPid: number;

	public constructor(rootPid: number, lastObservedWindows: WindowIdentity[]) {
		super(
			formatLaunchFailure({
				lastObservedWindows: lastObservedWindows,
				launchExitCode: null,
				launchStderr: "",
				launchStdout: "",
				rootPid: rootPid,
			}),
		);
		this.lastObservedWindows = lastObservedWindows;
		this.rootPid = rootPid;
	}
}

async function findWindowForLaunch(rootPid: number, timeoutMs = N_30000): Promise<WindowIdentity> {
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

		const pollIntervalMs = N_500;
		await Bun.sleep(pollIntervalMs);
	}

	const summary = lastObservedWindows.length > 0 ? lastObservedWindows : [];

	throw new WindowSearchTimeoutError(rootPid, summary);
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

	const killWaitTimeoutMs = N_5000;
	const deadline = Date.now() + killWaitTimeoutMs;
	while (Date.now() < deadline) {
		if (!pids.some((pid) => processExists(pid))) {
			return;
		}
		const killPollIntervalMs = N_100;
		await Bun.sleep(killPollIntervalMs);
	}

	for (const pid of pids) {
		if (processExists(pid)) {
			process.kill(pid, "SIGKILL");
		}
	}
}

async function verifyLinuxWindowIdentity(args: VerifyArgs): Promise<void> {
	if (!Bun.env["DISPLAY"]) {
		throw new Error("DISPLAY is not set. Run this script under xvfb-run or an X11 session.");
	}

	const launcherPath = await resolveLinuxLauncherPath(args.bundlePath);
	const tempHome = await mkdtemp(join(tmpdir(), "klovi-linux-window-"));
	const settingsPath = join(tempHome, "settings.json");
	const proc = Bun.spawn([launcherPath], {
		cwd: dirname(launcherPath),
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...Bun.env,
			["HOME"]: tempHome,
			["KLOVI_SETTINGS_PATH"]: settingsPath,
		},
	});
	const stdoutPromise = new Response(proc.stdout).text();
	const stderrPromise = new Response(proc.stderr).text();
	let launchExitCode: number | null = null;
	const exitCodePromise = proc.exited.then((exitCode) => {
		launchExitCode = exitCode;
		return exitCode;
	});

	try {
		const { pid } = proc;
		if (pid == null) {
			throw new Error("Failed to start launcher process");
		}

		let identity: WindowIdentity;
		try {
			identity = await findWindowForLaunch(pid);
		} catch (error) {
			if (error instanceof WindowSearchTimeoutError && launchExitCode !== null) {
				await exitCodePromise;
				const [launchStdout, launchStderr] = await Promise.all([stdoutPromise, stderrPromise]);
				throw new Error(
					formatLaunchFailure({
						lastObservedWindows: error.lastObservedWindows,
						launchExitCode: launchExitCode,
						launchStderr: launchStderr,
						launchStdout: launchStdout,
						rootPid: error.rootPid,
					}),
					{ cause: error },
				);
			}
			throw error;
		}
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
	} finally {
		if (proc.pid != null) {
			await killProcessTree(proc.pid);
		}
		await Promise.allSettled([exitCodePromise, stdoutPromise, stderrPromise]);
		await rm(tempHome, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	try {
		await verifyLinuxWindowIdentity(parseArgs(Bun.argv));
	} catch {
		process.exit(1);
	}
}

export type { LaunchFailureDetails, WindowIdentity };
export { formatLaunchFailure, parseArgs, parsePidList, selectWindowCandidate, verifyLinuxWindowIdentity };
