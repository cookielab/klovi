import { describe, expect, test } from "bun:test";
import { formatLaunchFailure, parseArgs, parsePidList, selectWindowCandidate } from "./verify-linux-window-identity.ts";

describe("parseArgs", () => {
	test("accepts a single bundle path", () => {
		expect(parseArgs(["bun", "verify-linux-window-identity.ts", "/tmp/Klovi"])).toEqual({
			bundlePath: "/tmp/Klovi",
		});
	});
});

describe("parsePidList", () => {
	test("parses ps output with mixed whitespace", () => {
		expect(parsePidList(" 123\n456 \n\n 789\n")).toEqual([123, 456, 789]);
	});
});

describe("selectWindowCandidate", () => {
	test("prefers a matching window owned by the launcher process family", () => {
		const result = selectWindowCandidate(
			[
				{
					id: "0x1",
					pid: 999,
					wmClass: '"Klovi", "Klovi"',
					name: "Klovi",
				},
				{
					id: "0x2",
					pid: 321,
					wmClass: '"Klovi", "Klovi"',
					name: "Klovi",
				},
			],
			new Set([321]),
			new Set<string>(),
		);

		expect(result?.id).toBe("0x2");
	});

	test("falls back to a new matching window when the owner pid changed", () => {
		const result = selectWindowCandidate(
			[
				{
					id: "0x1",
					pid: 999,
					wmClass: '"Klovi", "Klovi"',
					name: "Klovi",
				},
			],
			new Set([321]),
			new Set(["0x0"]),
		);

		expect(result?.id).toBe("0x1");
	});

	test("ignores stale or incorrectly branded windows", () => {
		const result = selectWindowCandidate(
			[
				{
					id: "0x1",
					pid: 321,
					// biome-ignore lint/security/noSecrets: test fixture uses the known upstream WM_CLASS string
					wmClass: '"ElectrobunKitchenSink", "ElectrobunKitchenSink"',
					name: "Klovi",
				},
				{
					id: "0x2",
					pid: 654,
					wmClass: '"Klovi", "Klovi"',
					name: "Browser",
				},
				{
					id: "0x3",
					pid: 777,
					wmClass: '"Klovi", "Klovi"',
					name: "Klovi",
				},
			],
			new Set([321]),
			new Set(["0x3"]),
		);

		expect(result).toBeNull();
	});
});

describe("formatLaunchFailure", () => {
	test("includes launcher exit diagnostics when the process exits early", () => {
		const message = formatLaunchFailure({
			lastObservedWindows: [],
			launchExitCode: 127,
			launchStderr: "error while loading shared libraries: libwebkit2gtk-4.1.so.0",
			launchStdout: "Launcher starting on linux...",
			rootPid: 1234,
		});

		expect(message).toContain("Timed out waiting for a Klovi window after launching pid 1234.");
		expect(message).toContain("Launcher exited before a matching window appeared (exit code 127).");
		expect(message).toContain("Launcher stderr tail:");
		expect(message).toContain("libwebkit2gtk-4.1.so.0");
		expect(message).toContain("Launcher stdout tail:");
	});

	test("includes the last observed windows in timeout output", () => {
		const message = formatLaunchFailure({
			lastObservedWindows: [
				{
					id: "0x9",
					pid: 321,
					wmClass: '"Browser", "Browser"',
					name: "Browser",
				},
			],
			launchExitCode: null,
			launchStderr: "",
			launchStdout: "",
			rootPid: 456,
		});

		expect(message).toContain('0x9 pid=321 wmClass="Browser", "Browser" name=Browser');
	});
});
