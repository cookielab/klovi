import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type KloviPackageServer, startKloviPackageServer } from "./server.ts";

const tmpStaticDir = resolve(import.meta.dir, "../.test-integration-static");

describe("apps/package integration", () => {
	let server: KloviPackageServer;

	beforeAll(async () => {
		mkdirSync(tmpStaticDir, { recursive: true });
		// biome-ignore lint/security/noSecrets: HTML test fixture, not a secret
		writeFileSync(join(tmpStaticDir, "index.html"), "<html><body>Klovi</body></html>");
		writeFileSync(join(tmpStaticDir, "app.js"), "console.log('app')");

		server = await startKloviPackageServer({
			host: "127.0.0.1",
			port: 0,
			staticDir: tmpStaticDir,
			version: "1.0.0",
			commit: "test123",
		});
	});

	afterAll(() => {
		server?.stop();
		rmSync(tmpStaticDir, { recursive: true, force: true });
	});

	test("RPC: getVersion returns configured version", async () => {
		const res = await fetch(`${server.url}/api/rpc/getVersion`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as { version: string; commit: string };
		expect(data.version).toBe("1.0.0");
		expect(data.commit).toBe("test123");
	});

	test("RPC: unknown method returns 404", async () => {
		const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(404);
	});

	test("static: GET / serves index.html", async () => {
		const res = await fetch(server.url);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Klovi");
	});

	test("static: GET /app.js serves JS file", async () => {
		const res = await fetch(`${server.url}/app.js`);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("console.log");
	});

	test("static: SPA fallback for unknown route serves index.html", async () => {
		const res = await fetch(`${server.url}/some/deep/route`);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Klovi");
	});
});
