import { type KloviServer, startKloviServer } from "./server";

const N_200 = 200;
const N_404 = 404;
const N_400 = 400;

const URL_PATTERN = /^http:\/\/127\.0\.0\.1:\d+$/u;

describe("startKloviServer", () => {
	let server: KloviServer;

	beforeAll(async () => {
		server = await startKloviServer({ host: "127.0.0.1", port: 0 });
	});

	afterAll(() => {
		server?.stop();
	});

	it("returns a URL", () => {
		expect(server.url).toMatch(URL_PATTERN);
	});

	it("POST /api/rpc/getVersion returns version info", async () => {
		const res = await fetch(`${server.url}/api/rpc/getVersion`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { version: string; commit: string };
		expect(data).toHaveProperty("version");
		expect(data).toHaveProperty("commit");
	});

	it("POST /api/rpc/acceptRisks returns ok", async () => {
		const res = await fetch(`${server.url}/api/rpc/acceptRisks`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
	});

	it("POST /api/rpc/unknown returns 404", async () => {
		const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_404);
	});

	it("POST /api/rpc/ without method returns 400", async () => {
		const res = await fetch(`${server.url}/api/rpc/`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_400);
	});

	it("POST with invalid JSON returns 400", async () => {
		const res = await fetch(`${server.url}/api/rpc/getVersion`, {
			method: "POST",
			body: "not json{{{",
		});
		expect(res.status).toBe(N_400);
	});

	it("GET / returns 404", async () => {
		const res = await fetch(server.url);
		expect(res.status).toBe(N_404);
	});
});
