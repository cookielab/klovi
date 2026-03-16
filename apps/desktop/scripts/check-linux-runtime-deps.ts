#!/usr/bin/env bun

import { delimiter, resolve } from "node:path";
import {
  collectLinuxLibrarySearchPaths,
  resolveLinuxLauncherPath,
  resolveLinuxNativeWrapperPaths,
} from "./linux-bundle.ts";

const MISSING_DEPENDENCY_REGEX = /^\s*(\S+)\s*=>\s*not found\s*$/;
const NON_DYNAMIC_EXECUTABLE_REGEX = /\b(not a dynamic executable|statically linked)\b/i;

export type RuntimeDependencyArgs = {
  bundlePath: string;
};

export type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type CommandRunner = (
  command: string[],
  env: Record<string, string | undefined>,
) => Promise<CommandResult>;

export function parseArgs(argv: string[]): RuntimeDependencyArgs {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
    throw new Error("Usage: bun check-linux-runtime-deps.ts <bundle-path>");
  }
  return { bundlePath: args[0] };
}

export function parseMissingDependencies(stdout: string): string[] {
  const missing = new Set<string>();

  for (const line of stdout.split("\n")) {
    const match = line.match(MISSING_DEPENDENCY_REGEX);
    if (match?.[1]) {
      missing.add(match[1]);
    }
  }

  return [...missing].sort();
}

export function buildLdLibraryPath(libraryDirs: string[], currentValue?: string): string {
  const entries = [...libraryDirs];
  if (currentValue) {
    entries.push(...currentValue.split(delimiter).filter(Boolean));
  }

  return [...new Set(entries)].join(delimiter);
}

export function isSkippableLddFailure(output: string): boolean {
  return NON_DYNAMIC_EXECUTABLE_REGEX.test(output);
}

async function runCommand(
  command: string[],
  env: Record<string, string | undefined>,
): Promise<CommandResult> {
  const proc = Bun.spawn(command, {
    env,
    stderr: "pipe",
    stdout: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stderr, stdout };
}

export async function checkLinuxRuntimeDeps(
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

  console.log(`Verified Linux runtime dependencies: ${launcherPath}`);
}

if (import.meta.main) {
  try {
    await checkLinuxRuntimeDeps(parseArgs(Bun.argv));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
