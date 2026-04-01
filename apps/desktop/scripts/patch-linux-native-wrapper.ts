#!/usr/bin/env bun

import { resolve } from "node:path";
import { resolveLinuxNativeWrapperPaths } from "./linux-bundle.ts";

const UPSTREAM_WM_CLASS = "ElectrobunKitchenSink-dev";
const EXPECTED_WM_CLASS = "Klovi";

const SEARCH_BYTES = Buffer.from(UPSTREAM_WM_CLASS, "utf-8");
const REPLACEMENT_BYTES = Buffer.alloc(SEARCH_BYTES.length);
REPLACEMENT_BYTES.write(EXPECTED_WM_CLASS, "utf-8");

type PatchArgs = {
	bundlePath: string;
};

type PatchStatus = "patched" | "already_patched" | "missing_target";

type PatchResult = {
	libraryPath: string;
	replacements: number;
	status: PatchStatus;
};

function parseArgs(argv: string[]): PatchArgs {
	const args = argv.slice(2);
	if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
		throw new Error("Usage: bun patch-linux-native-wrapper.ts <bundle-path>");
	}
	return { bundlePath: args[0] };
}

function patchNativeWrapperBytes(source: Uint8Array): {
	alreadyPatched: boolean;
	bytes: Buffer;
	replacements: number;
} {
	const bytes = Buffer.from(source);
	let replacements = 0;
	let offset = 0;

	while (offset < bytes.length) {
		const nextIndex = bytes.indexOf(SEARCH_BYTES, offset);
		if (nextIndex === -1) {
			break;
		}

		REPLACEMENT_BYTES.copy(bytes, nextIndex);
		replacements += 1;
		offset = nextIndex + SEARCH_BYTES.length;
	}

	return {
		alreadyPatched: replacements === 0 && bytes.indexOf(REPLACEMENT_BYTES) !== -1,
		bytes: bytes,
		replacements: replacements,
	};
}

async function patchNativeWrapperLibrary(libraryPath: string): Promise<PatchResult> {
	const file = Bun.file(libraryPath);
	const { alreadyPatched, bytes, replacements } = patchNativeWrapperBytes(new Uint8Array(await file.arrayBuffer()));

	if (replacements > 0) {
		await Bun.write(libraryPath, bytes);
		return {
			libraryPath: libraryPath,
			replacements: replacements,
			status: "patched",
		};
	}

	return {
		libraryPath: libraryPath,
		replacements: replacements,
		status: alreadyPatched ? "already_patched" : "missing_target",
	};
}

async function patchLinuxNativeWrapper(args: PatchArgs): Promise<PatchResult[]> {
	const bundlePath = resolve(args.bundlePath);
	const libraryPaths = await resolveLinuxNativeWrapperPaths(bundlePath);
	if (libraryPaths.length === 0) {
		throw new Error(`Could not find Linux native wrapper libraries under ${bundlePath}`);
	}

	const results = await Promise.all(libraryPaths.map((libraryPath) => patchNativeWrapperLibrary(libraryPath)));
	const missingTarget = results.filter((result) => result.status === "missing_target");
	if (missingTarget.length > 0) {
		throw new Error(
			`Expected WM_CLASS bytes not found in: ${missingTarget.map((result) => result.libraryPath).join(", ")}`,
		);
	}

	const patchedCount = results.filter((result) => result.status === "patched").length;
	const alreadyPatchedCount = results.filter((result) => result.status === "already_patched").length;
	if (patchedCount === 0 && alreadyPatchedCount === 0) {
		throw new Error(`No Linux native wrapper libraries were patched under ${bundlePath}`);
	}

	console.log(`Patched Linux native wrapper WM_CLASS: ${patchedCount} updated, ${alreadyPatchedCount} already patched`);
	return results;
}

if (import.meta.main) {
	try {
		await patchLinuxNativeWrapper(parseArgs(Bun.argv));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export type { PatchArgs, PatchResult, PatchStatus };
export {
	EXPECTED_WM_CLASS,
	parseArgs,
	patchLinuxNativeWrapper,
	patchNativeWrapperBytes,
	patchNativeWrapperLibrary,
	UPSTREAM_WM_CLASS,
};
