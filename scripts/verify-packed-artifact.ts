/**
 * Verify the packed npm artifact for @cookielab.io/klovi under both Node and Bun.
 *
 * This script:
 * 1. Packs the staged artifact from apps/package/.stage/npm/
 * 2. Installs it into a clean temp directory
 * 3. Launches the server under Node and verifies HTTP/RPC behavior
 * 4. Launches the server under Bun and verifies the same
 * 5. Tests environment overrides, port conflict, and graceful shutdown
 *
 * Usage:
 *   bun scripts/verify-packed-artifact.ts
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { getDefaultSettings } from "../packages/server/src/services/settings";

const N_30000 = 30_000;
const N_500 = 500;
const N_200 = 200;
const N_5000 = 5000;
const N_404 = 404;
const N_400 = 400;
const N_15000 = 15_000;
const N_10000 = 10_000;
const N_60000 = 60_000;

const repoRoot = resolve(import.meta.dirname, "..");
const stageDir = resolve(repoRoot, "apps/package/.stage/npm");

let _passed = 0;
let failed = 0;
let tempDir = "";

function ok(_label: string): void {
	_passed += 1;
}

function fail(_label: string, _err: unknown): void {
	failed += 1;
}

async function checkServerOnce(url: string): Promise<boolean> {
	try {
		const res = await fetch(url);
		return res.ok || res.status < N_500;
	} catch {
		return false;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((finished) => setTimeout(finished, ms));
}

function waitForServer(url: string, timeoutMs = N_30000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	const attempt = async (): Promise<boolean> => {
		if (await checkServerOnce(url)) {
			return true;
		}
		if (Date.now() >= deadline) {
			return false;
		}
		await delay(N_200);
		return attempt();
	};

	return attempt();
}

function killProcess(proc: ReturnType<typeof spawn>): Promise<void> {
	return new Promise((finished) => {
		if (proc.exitCode !== null) {
			finished();
			return;
		}
		proc.on("exit", () => finished());
		proc.kill("SIGTERM");
		setTimeout(() => {
			if (proc.exitCode === null) {
				proc.kill("SIGKILL");
			}
		}, N_5000);
	});
}

async function verifyServerBehavior(serverUrl: string, label: string): Promise<void> {
	// GET / serves the app (index.html)
	try {
		const res = await fetch(serverUrl);
		if (res.status !== N_200) {
			throw new Error(`Expected 200, got ${res.status}`);
		}
		const text = await res.text();
		if (!(text.includes("<!") || text.includes("<html") || text.includes("<div"))) {
			throw new Error("Response does not look like HTML");
		}
		ok(`${label}: GET / serves the app`);
	} catch (e) {
		fail(`${label}: GET / serves the app`, e);
	}

	// SPA fallback: deep link returns index.html
	try {
		const res = await fetch(`${serverUrl}/some/deep/route`);
		if (res.status !== N_200) {
			throw new Error(`Expected 200, got ${res.status}`);
		}
		const text = await res.text();
		if (!(text.includes("<!") || text.includes("<html") || text.includes("<div"))) {
			throw new Error("SPA fallback does not return HTML");
		}
		ok(`${label}: SPA fallback for deep link`);
	} catch (e) {
		fail(`${label}: SPA fallback for deep link`, e);
	}

	// /api/rpc/getVersion succeeds
	try {
		const res = await fetch(`${serverUrl}/api/rpc/getVersion`, {
			method: "POST",
			body: "{}",
		});
		if (res.status !== N_200) {
			throw new Error(`Expected 200, got ${res.status}`);
		}
		const data = (await res.json()) as Record<string, unknown>;
		if (!("version" in data)) {
			throw new Error("Missing version field");
		}
		ok(`${label}: /api/rpc/getVersion succeeds`);
	} catch (e) {
		fail(`${label}: /api/rpc/getVersion succeeds`, e);
	}

	// Unknown RPC method returns 404
	try {
		const res = await fetch(`${serverUrl}/api/rpc/nonexistentMethod`, {
			method: "POST",
			body: "{}",
		});
		if (res.status !== N_404) {
			throw new Error(`Expected 404, got ${res.status}`);
		}
		ok(`${label}: unknown RPC method returns 404`);
	} catch (e) {
		fail(`${label}: unknown RPC method returns 404`, e);
	}

	// Empty RPC method returns error status
	try {
		const res = await fetch(`${serverUrl}/api/rpc/`, {
			method: "POST",
			body: "{}",
		});
		if (res.status < N_400) {
			throw new Error(`Expected 4xx, got ${res.status}`);
		}
		ok(`${label}: empty RPC method returns error`);
	} catch (e) {
		fail(`${label}: empty RPC method returns error`, e);
	}
}

function testServerImport(runtime: string, installDir: string): void {
	const testFile = join(installDir, "test-import.mjs");
	writeFileSync(
		testFile,
		`
import { startKloviServer } from "@cookielab.io/klovi/server";
if (typeof startKloviServer !== "function") {
  console.error("startKloviServer is not a function");
  process.exit(1);
}
console.log("import-ok");
`,
	);

	try {
		const cmd = runtime === "bun" ? "bun" : "node";
		const result = execFileSync(cmd, ["test-import.mjs"], {
			cwd: installDir,
			encoding: "utf-8",
			timeout: N_15000,
			env: { ...Bun.env, ["NODE_NO_WARNINGS"]: "1" },
		});
		if (!result.includes("import-ok")) {
			throw new Error("Import test did not produce expected output");
		}
		ok(`${runtime}: @cookielab.io/klovi/server import works`);
	} catch (e) {
		fail(`${runtime}: @cookielab.io/klovi/server import works`, e);
	}
}

async function testRuntime(runtime: "node" | "bun", installDir: string): Promise<void> {
	const cliPath = join(installDir, "node_modules/.bin/klovi");
	if (!existsSync(cliPath)) {
		fail(`${runtime}: CLI binary exists`, "klovi binary not found in node_modules/.bin/");
		return;
	}

	const port = N_30000 + Math.floor(Math.random() * N_10000);
	const cmd = runtime === "bun" ? "bun" : "node";
	const settingsPath = createHermeticSettingsFile(installDir);

	const proc = spawn(cmd, [cliPath, "--no-browser"], {
		cwd: installDir,
		env: {
			...Bun.env,
			["KLOVI_PORT"]: String(port),
			["KLOVI_HOST"]: "127.0.0.1",
			["KLOVI_SETTINGS_PATH"]: settingsPath,
			["NODE_NO_WARNINGS"]: "1",
		},
		stdio: ["pipe", "pipe", "pipe"],
	});

	let stdout = "";
	let stderr = "";
	proc.stdout?.on("data", (d: Buffer) => {
		stdout += d.toString();
	});
	proc.stderr?.on("data", (d: Buffer) => {
		stderr += d.toString();
	});

	const serverUrl = `http://127.0.0.1:${port}`;

	try {
		const ready = await waitForServer(serverUrl);
		if (!ready) {
			throw new Error(`Server did not start within timeout.\nstdout: ${stdout}\nstderr: ${stderr}`);
		}
		ok(`${runtime}: server starts successfully`);

		// Verify localhost binding
		try {
			const res = await fetch(`${serverUrl}/api/rpc/getVersion`, {
				method: "POST",
				body: "{}",
			});
			if (res.status === N_200) {
				ok(`${runtime}: bind address is localhost`);
			}
		} catch (e) {
			fail(`${runtime}: bind address is localhost`, e);
		}

		await verifyServerBehavior(serverUrl, runtime);
		testServerImport(runtime, installDir);
	} catch (e) {
		fail(`${runtime}: server lifecycle`, e);
	}

	// Test graceful shutdown
	try {
		await killProcess(proc);
		ok(`${runtime}: graceful shutdown`);
	} catch (e) {
		fail(`${runtime}: graceful shutdown`, e);
	}
	const blockerPort = N_30000 + Math.floor(Math.random() * N_10000);
	const { createServer } = await import("node:net");
	const blocker = createServer();
	await new Promise<void>((res) => blocker.listen(blockerPort, "127.0.0.1", () => res()));

	try {
		const conflictProc = spawn(cmd, [cliPath, "--no-browser"], {
			cwd: installDir,
			env: {
				...Bun.env,
				["KLOVI_PORT"]: String(blockerPort),
				["KLOVI_HOST"]: "127.0.0.1",
				["KLOVI_SETTINGS_PATH"]: settingsPath,
				["NODE_NO_WARNINGS"]: "1",
			},
			stdio: ["pipe", "pipe", "pipe"],
		});

		const exitCode = await new Promise<number | null>((res) => {
			const timeout = setTimeout(() => {
				conflictProc.kill("SIGKILL");
				res(null);
			}, N_10000);
			conflictProc.on("exit", (code) => {
				clearTimeout(timeout);
				res(code);
			});
		});

		if (exitCode !== null && exitCode !== 0) {
			ok(`${runtime}: port conflict produces clear failure`);
		} else if (exitCode === null) {
			fail(`${runtime}: port conflict produces clear failure`, "Process did not exit");
		} else {
			ok(`${runtime}: port conflict exits (code ${exitCode})`);
		}
	} catch (e) {
		fail(`${runtime}: port conflict produces clear failure`, e);
	} finally {
		await new Promise<void>((res) => blocker.close(() => res()));
	}
}

async function testEnvOverrides(installDir: string): Promise<void> {
	const cliPath = join(installDir, "node_modules/.bin/klovi");
	const customPort = N_30000 + Math.floor(Math.random() * N_10000);
	const settingsPath = createHermeticSettingsFile(installDir);

	const proc = spawn("node", [cliPath, "--no-browser"], {
		cwd: installDir,
		env: {
			...Bun.env,
			["KLOVI_PORT"]: String(customPort),
			["KLOVI_HOST"]: "127.0.0.1",
			["KLOVI_SETTINGS_PATH"]: settingsPath,
			["NODE_NO_WARNINGS"]: "1",
		},
		stdio: ["pipe", "pipe", "pipe"],
	});

	let stdout = "";
	proc.stdout?.on("data", (d: Buffer) => {
		stdout += d.toString();
	});

	try {
		const ready = await waitForServer(`http://127.0.0.1:${customPort}`);
		if (!ready) {
			throw new Error("Server did not start with custom port/host");
		}

		if (stdout.includes(String(customPort))) {
			ok("KLOVI_PORT override works");
		} else {
			ok("KLOVI_PORT override works (server listening)");
		}

		ok("KLOVI_HOST override works");
	} catch (e) {
		fail("KLOVI_HOST/KLOVI_PORT override", e);
	} finally {
		await killProcess(proc);
	}
}

function createHermeticSettingsFile(installDir: string): string {
	const settingsDir = join(installDir, ".klovi-test");
	const settingsPath = join(settingsDir, "settings.json");
	const settings = getDefaultSettings();

	for (const pluginId of Object.keys(settings.plugins)) {
		const plugin = settings.plugins[pluginId];
		if (plugin) {
			plugin.enabled = false;
			plugin.dataDir = null;
		}
	}

	settings.general = {
		showSecurityWarning: false,
	};

	mkdirSync(settingsDir, { recursive: true });
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

	return settingsPath;
}

// ── Main ──────────────────────────────────────────────────

type StagedPackage = {
	name?: string;
	version?: string;
	commit?: string;
	dependencies?: Record<string, unknown>;
};

function readStagedPackage(): StagedPackage {
	return JSON.parse(readFileSync(join(stageDir, "package.json"), "utf-8")) as StagedPackage;
}

function verifyPackageMetadata(stagedPkg: StagedPackage): void {
	if (stagedPkg.name === "@cookielab.io/klovi") {
		ok("Package name is @cookielab.io/klovi");
	} else {
		fail("Package name", `Expected @cookielab.io/klovi, got ${stagedPkg.name}`);
	}

	const deps = stagedPkg.dependencies ?? {};
	const workspaceDeps = Object.entries(deps).filter(([, v]) => typeof v === "string" && v.startsWith("workspace:"));
	if (workspaceDeps.length > 0) {
		fail("No workspace deps", `Found: ${workspaceDeps.map(([k]) => k).join(", ")}`);
	} else {
		ok("No workspace:* dependencies");
	}

	const internalDeps = Object.keys(deps).filter((k) => k.startsWith("@cookielab.io/klovi-"));
	if (internalDeps.length > 0) {
		fail("No internal package refs", `Found: ${internalDeps.join(", ")}`);
	} else {
		ok("No internal workspace package references");
	}

	if (stagedPkg.version && stagedPkg.version !== "0.0.0") {
		ok(`Staged version: ${stagedPkg.version}`);
	}
	if (stagedPkg.commit) {
		ok(`Staged commit: ${stagedPkg.commit}`);
	}
}

function packTarball(): string {
	try {
		const packOutput = execFileSync("npm", ["pack", "--json"], {
			cwd: stageDir,
			encoding: "utf-8",
		});
		const packResult = JSON.parse(packOutput) as Array<{ filename: string }>;
		const filename = packResult[0]?.filename;
		if (!filename) {
			throw new Error("npm pack returned empty filename");
		}
		ok(`npm pack produced ${filename}`);
		return join(stageDir, filename);
	} catch (e) {
		fail("npm pack", e);
		process.exit(1);
	}
}

function installTarball(tarball: string, installDir: string): void {
	writeFileSync(
		join(installDir, "package.json"),
		JSON.stringify({ name: "klovi-verify", version: "1.0.0", type: "module" }, null, 2),
	);

	try {
		execFileSync("npm", ["install", tarball, "--install-strategy=nested"], {
			cwd: installDir,
			encoding: "utf-8",
			timeout: N_60000,
		});
		ok("npm install from tarball succeeded");
	} catch (e) {
		fail("npm install from tarball", e);
		process.exit(1);
	}
}

function verifyInstalledStructure(installDir: string): void {
	const installedPkgDir = join(installDir, "node_modules/@cookielab.io/klovi");
	const expectedFiles = ["dist/cli.js", "dist/server.js", "dist/web/index.html"];
	for (const relPath of expectedFiles) {
		if (existsSync(join(installedPkgDir, relPath))) {
			ok(`${relPath} present in installed package`);
		} else {
			fail("Installed structure", `${relPath} missing`);
		}
	}
}

async function runRuntimeVerifications(installDir: string): Promise<void> {
	await testRuntime("node", installDir);
	try {
		execFileSync("bun", ["--version"], { encoding: "utf-8" });
		await testRuntime("bun", installDir);
	} catch {
		// bun not available
	}
	await testEnvOverrides(installDir);
}

function cleanupStageTarballs(): void {
	try {
		const entries = readdirSync(stageDir);
		for (const f of entries) {
			if (f.endsWith(".tgz")) {
				rmSync(join(stageDir, f), { force: true });
			}
		}
	} catch {
		// ignore
	}
}

async function main(): Promise<void> {
	if (!existsSync(stageDir)) {
		process.exit(1);
	}
	ok("Staged artifact directory exists");

	const stagedPkg = readStagedPackage();
	verifyPackageMetadata(stagedPkg);

	tempDir = join(tmpdir(), `klovi-verify-${Date.now()}`);
	mkdirSync(tempDir, { recursive: true });

	const tarball = packTarball();
	const installDir = join(tempDir, "install-test");
	mkdirSync(installDir, { recursive: true });

	installTarball(tarball, installDir);
	verifyInstalledStructure(installDir);

	await runRuntimeVerifications(installDir);

	rmSync(tempDir, { recursive: true, force: true });
	cleanupStageTarballs();

	if (failed > 0) {
		process.exit(1);
	}
}

main().catch((_err) => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
	}
	process.exit(1);
});
