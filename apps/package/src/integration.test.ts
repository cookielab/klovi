import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type KloviPackageServer, startKloviPackageServer } from "./server";

const N_200 = 200;
const N_404 = 404;

const tmpStaticDir = resolve(import.meta.dir, "../.test-integration-static");

describe("apps/package integration", () => {
	let server: KloviPackageServer;

	beforeAll(async () => {
		mkdirSync(tmpStaticDir, { recursive: true });
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

	it("RPC: getVersion returns configured version", async () => {
		const res = await fetch(`${server.url}/api/rpc/getVersion`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { version: string; commit: string };
		expect(data.version).toBe("1.0.0");
		expect(data.commit).toBe("test123");
	});

	it("RPC: unknown method returns 404", async () => {
		const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_404);
	});

	it("static: GET / serves index.html", async () => {
		const res = await fetch(server.url);
		expect(res.status).toBe(N_200);
		const text = await res.text();
		expect(text).toContain("Klovi");
	});

	it("static: GET /app.js serves JS file", async () => {
		const res = await fetch(`${server.url}/app.js`);
		expect(res.status).toBe(N_200);
		const text = await res.text();
		expect(text).toContain("console.log");
	});

	it("static: SPA fallback for unknown route serves index.html", async () => {
		const res = await fetch(`${server.url}/some/deep/route`);
		expect(res.status).toBe(N_200);
		const text = await res.text();
		expect(text).toContain("Klovi");
	});

	// Regression: missing hashed asset chunks (e.g. when a browser has cached
	// an older index.html referencing now-removed chunk filenames) must return
	// 404, not an HTML fallback. An HTML response for a <link rel="stylesheet">
	// or <script type="module"> is silently rejected by browsers and produces
	// the "broken CSS" symptom that prompted this fix.
	it("static: missing .css asset returns 404 (no index.html fallback)", async () => {
		const res = await fetch(`${server.url}/chunk-missing.css`);
		expect(res.status).toBe(N_404);
		expect(res.headers.get("content-type")).not.toContain("text/html");
	});

	it("static: missing .js asset returns 404 (no index.html fallback)", async () => {
		const res = await fetch(`${server.url}/chunk-missing.js`);
		expect(res.status).toBe(N_404);
		expect(res.headers.get("content-type")).not.toContain("text/html");
	});
});
