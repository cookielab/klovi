import { type KloviPackageServer, startKloviPackageServer } from "./server";


const N_200 = 200;
const N_404 = 404;

const URL_PATTERN = /^http:\/\/127\.0\.0\.1:\d+$/u;

describe("startKloviPackageServer", () => {
	let server: KloviPackageServer;

	beforeAll(async () => {
		server = await startKloviPackageServer({ host: "127.0.0.1", port: 0 });
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
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { version: string; commit: string };
		expect(data).toHaveProperty("version");
		expect(data).toHaveProperty("commit");
	});

	it("POST /api/rpc/unknown returns 404", async () => {
		const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_404);
	});

	it("GET / returns 404 when no staticDir", async () => {
		const res = await fetch(server.url);
		expect(res.status).toBe(N_404);
	});
});
