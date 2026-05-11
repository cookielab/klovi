#!/usr/bin/env bun

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

const EXPECTED_LINUX_APP_NAME = "Klovi";
const EXPECTED_LINUX_APP_IDENTIFIER = "io.cookielab.klovi";
const EXPECTED_LINUX_WM_CLASS = "Klovi";
const EXPECTED_LINUX_ICON_BASENAME = "klovi";
const EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME = `${EXPECTED_LINUX_APP_IDENTIFIER}.desktop`;
const METADATA_FILENAMES = ["version.json", "metadata.json"] as const;

type WrapperMetadata = {
	identifier: string;
	name: string;
	channel: string;
	hash: string;
};

type Layout = {
	inputRoot: string;
	bundleRoot: string;
	desktopRoot: string;
	isAppDir: boolean;
};

type VerifyArgs = {
	bundlePath: string;
};

function parseArgs(argv: string[]): VerifyArgs {
	const args = argv.slice(2);
	if (args.length !== 1 || args[0] == null || args[0].startsWith("--")) {
		throw new Error("Usage: bun verify-linux-wrapper-contract.ts <bundle-path>");
	}
	return { bundlePath: args[0] };
}

async function hasMetadataFile(dir: string): Promise<boolean> {
	const checks = await Promise.all(
		METADATA_FILENAMES.map((filename) => Bun.file(join(dir, "Resources", filename)).exists()),
	);
	return checks.some((exists) => exists);
}

async function detectLayout(bundlePath: string): Promise<Layout> {
	const inputRoot = resolve(bundlePath);
	if (await hasMetadataFile(inputRoot)) {
		return {
			inputRoot: inputRoot,
			bundleRoot: inputRoot,
			desktopRoot: inputRoot,
			isAppDir: false,
		};
	}

	const appDirBundleRoot = join(inputRoot, "usr", "lib", EXPECTED_LINUX_ICON_BASENAME);
	if (await hasMetadataFile(appDirBundleRoot)) {
		return {
			inputRoot: inputRoot,
			bundleRoot: appDirBundleRoot,
			desktopRoot: inputRoot,
			isAppDir: true,
		};
	}

	throw new Error(`Could not find Linux bundle metadata under ${inputRoot}`);
}

function assertMetadata(data: unknown): asserts data is WrapperMetadata {
	if (typeof data !== "object" || data === null) {
		throw new Error("Wrapper metadata is not an object");
	}

	const metadata = data as Record<string, unknown>;
	if (
		typeof metadata["identifier"] !== "string" ||
		typeof metadata["name"] !== "string" ||
		typeof metadata["channel"] !== "string" ||
		typeof metadata["hash"] !== "string"
	) {
		throw new Error("Wrapper metadata is missing required fields");
	}
}

function parseDesktopEntry(raw: string): Map<string, string> {
	const entries = new Map<string, string>();
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("[") || trimmed.startsWith("#")) {
			continue;
		}

		const equalsIndex = trimmed.indexOf("=");
		if (equalsIndex <= 0) {
			continue;
		}

		entries.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
	}
	return entries;
}

async function readWrapperMetadata(bundleRoot: string): Promise<WrapperMetadata> {
	const candidates = METADATA_FILENAMES.map((filename) => join(bundleRoot, "Resources", filename));
	const existsResults = await Promise.all(candidates.map((filePath) => Bun.file(filePath).exists()));
	const foundIndex = existsResults.findIndex((exists) => exists);
	if (foundIndex >= 0 && candidates[foundIndex] !== undefined) {
		const filePath = candidates[foundIndex];
		const parsed: unknown = await Bun.file(filePath).json();
		assertMetadata(parsed);
		return parsed;
	}
	throw new Error(`No metadata file found under ${join(bundleRoot, "Resources")}`);
}

async function findDesktopEntryPath(desktopRoot: string): Promise<string> {
	const entries = await readdir(desktopRoot);
	const desktopEntries = entries.filter((entry) => entry.endsWith(".desktop"));
	const expectedPath = join(desktopRoot, EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME);

	if (desktopEntries.includes(EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME)) {
		return expectedPath;
	}

	const foundSummary = desktopEntries.length > 0 ? desktopEntries.join(", ") : "(none found)";
	throw new Error(`Expected desktop entry ${EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME}, found ${foundSummary}`);
}

async function assertBundleIcons(bundleRoot: string): Promise<void> {
	const iconPaths = [join(bundleRoot, "Resources", "appIcon.png"), join(bundleRoot, "Resources", "app", "icon.png")];
	const checks = await Promise.all(iconPaths.map((path) => Bun.file(path).exists()));
	const missingIndex = checks.findIndex((exists) => !exists);
	if (missingIndex >= 0) {
		throw new Error(`Missing required icon asset: ${iconPaths[missingIndex]}`);
	}
}

async function assertAppDirIcons(inputRoot: string): Promise<void> {
	const iconPaths = [join(inputRoot, `${EXPECTED_LINUX_ICON_BASENAME}.png`), join(inputRoot, ".DirIcon")];
	const checks = await Promise.all(iconPaths.map((path) => Bun.file(path).exists()));
	const missingIndex = checks.findIndex((exists) => !exists);
	if (missingIndex >= 0) {
		throw new Error(`Missing required AppDir icon asset: ${iconPaths[missingIndex]}`);
	}
}

async function verifyLinuxWrapperContract(args: VerifyArgs): Promise<void> {
	const layout = await detectLayout(args.bundlePath);
	const metadata = await readWrapperMetadata(layout.bundleRoot);

	if (metadata.identifier !== EXPECTED_LINUX_APP_IDENTIFIER) {
		throw new Error(`Expected identifier ${EXPECTED_LINUX_APP_IDENTIFIER}, got ${metadata.identifier}`);
	}
	if (metadata.name !== EXPECTED_LINUX_APP_NAME) {
		throw new Error(`Expected name ${EXPECTED_LINUX_APP_NAME}, got ${metadata.name}`);
	}

	const desktopEntryPath = await findDesktopEntryPath(layout.desktopRoot);
	const desktopEntry = parseDesktopEntry(await Bun.file(desktopEntryPath).text());
	const expectedEntries: Record<string, string> = {
		["Name"]: EXPECTED_LINUX_APP_NAME,
		["StartupWMClass"]: EXPECTED_LINUX_WM_CLASS,
	};

	for (const [key, value] of Object.entries(expectedEntries)) {
		if (desktopEntry.get(key) !== value) {
			throw new Error(`Expected ${key}=${value} in ${desktopEntryPath}`);
		}
	}

	await assertBundleIcons(layout.bundleRoot);
	if (layout.isAppDir) {
		await assertAppDirIcons(layout.inputRoot);
	}
}

if (import.meta.main) {
	try {
		await verifyLinuxWrapperContract(parseArgs(Bun.argv));
	} catch {
		process.exit(1);
	}
}

export type { VerifyArgs };
export {
	detectLayout,
	EXPECTED_LINUX_APP_IDENTIFIER,
	EXPECTED_LINUX_APP_NAME,
	EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME,
	EXPECTED_LINUX_ICON_BASENAME,
	EXPECTED_LINUX_WM_CLASS,
	METADATA_FILENAMES,
	parseArgs,
	parseDesktopEntry,
	verifyLinuxWrapperContract,
};
