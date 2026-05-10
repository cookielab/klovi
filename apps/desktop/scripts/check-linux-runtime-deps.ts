#!/usr/bin/env bun

import { delimiter, resolve } from "node:path";
import process from "node:process";
import {
	collectLinuxLibrarySearchPaths,
	resolveLinuxLauncherPath,
	resolveLinuxNativeWrapperPaths,
} from "./linux-bundle";

const MISSING_DEPENDENCY_REGEX = /^\s*(?<lib>\S+)\s*=>\s*not found\s*$/u;
const NON_DYNAMIC_EXECUTABLE_REGEX = /\b(?:not a dynamic executable|statically linked)\b/iu;

type RuntimeDependencyArgs = {
	bundlePath: string;
};

type CommandResult = {
	exitCode: number;
	stderr: string;
	stdout: string;
};

type CommandRunner = (command: string[], env: Record<string, string | undefined>) => Promise<CommandResult>;

function parseArgs(argv: string[]): RuntimeDependencyArgs {
	const args = argv.slice(2);
	if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
		throw new Error("Usage: bun check-linux-runtime-deps.ts <bundle-path>");
	}
	return { bundlePath: args[0] };
}

function parseMissingDependencies(stdout: string): string[] {
	const missing = new Set<string>();

	for (const line of stdout.split("\n")) {
		const match = line.match(MISSING_DEPENDENCY_REGEX);
		if (match?.groups?.["lib"]) {
			missing.add(match.groups["lib"]);
		}
	}

	return [...missing].sort();
}

function buildLdLibraryPath(libraryDirs: string[], currentValue?: string): string {
	const entries = [...libraryDirs];
	if (currentValue) {
		entries.push(...currentValue.split(delimiter).filter(Boolean));
	}

	return [...new Set(entries)].join(delimiter);
}

function isSkippableLddFailure(output: string): boolean {
	return NON_DYNAMIC_EXECUTABLE_REGEX.test(output);
}

async function runCommand(command: string[], env: Record<string, string | undefined>): Promise<CommandResult> {
	const proc = Bun.spawn(command, {
		env: env,
		stderr: "pipe",
		stdout: "pipe",
	});

	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;

	return { exitCode: exitCode, stderr: stderr, stdout: stdout };
}

async function checkLinuxRuntimeDeps(
	args: RuntimeDependencyArgs,
	commandRunner: CommandRunner = runCommand,
): Promise<void> {
	const bundlePath = resolve(args.bundlePath);
	const launcherPath = await resolveLinuxLauncherPath(bundlePath);
	const nativeWrapperPaths = await resolveLinuxNativeWrapperPaths(bundlePath);
	if (nativeWrapperPaths.length === 0) {
		throw new Error(`Could not find Linux native wrapper libraries under ${bundlePath}`);
	}

	const libraryDirs = await collectLinuxLibrarySearchPaths(bundlePath);
	const env = {
		...Bun.env,
		LD_LIBRARY_PATH: buildLdLibraryPath(libraryDirs, Bun.env["LD_LIBRARY_PATH"]),
	};

	const failures: string[] = [];
	for (const targetPath of [launcherPath, ...nativeWrapperPaths]) {
		const result = await commandRunner(["ldd", targetPath], env);
		if (result.exitCode !== 0) {
			const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
			if (isSkippableLddFailure(combinedOutput)) {
				continue;
			}
			throw new Error(combinedOutput || `ldd failed for ${targetPath}`);
		}

		const missing = parseMissingDependencies(result.stdout);
		if (missing.length > 0) {
			failures.push(`${targetPath}: ${missing.join(", ")}`);
		}
	}

	if (failures.length > 0) {
		throw new Error(
			[
				`Missing Linux runtime dependencies for ${launcherPath}:`,
				...failures,
				`LD_LIBRARY_PATH=${env["LD_LIBRARY_PATH"] ?? ""}`,
			].join("\n"),
		);
	}
}

if (import.meta.main) {
	try {
		await checkLinuxRuntimeDeps(parseArgs(Bun.argv));
	} catch {
		process.exit(1);
	}
}

export type { CommandResult, CommandRunner, RuntimeDependencyArgs };
export { buildLdLibraryPath, checkLinuxRuntimeDeps, isSkippableLddFailure, parseArgs, parseMissingDependencies };
