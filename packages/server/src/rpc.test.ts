import { RpcError } from "./rpc-error";
import { type KloviServer, startKloviServer } from "./server";


const N_200 = 200;
const N_404 = 404;

describe("RPC dispatch", () => {
	let server: KloviServer;

	beforeAll(async () => {
		server = await startKloviServer({
			host: "127.0.0.1",
			port: 0,
			version: "1.0.0",
			commit: "test",
		});
	});

	afterAll(() => {
		server?.stop();
	});

	it("returns result for known method", async () => {
		const res = await fetch(`${server.url}/api/rpc/getVersion`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { version: string; commit: string };
		expect(data).toHaveProperty("version");
		expect(data).toHaveProperty("commit");
	});

	it("returns 404 for unknown method", async () => {
		const res = await fetch(`${server.url}/api/rpc/nonexistent`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_404);
		const data = (await res.json()) as { error: string };
		expect(data.error).toContain("Unknown method");
	});

	it("acceptRisks returns ok", async () => {
		const res = await fetch(`${server.url}/api/rpc/acceptRisks`, {
			method: "POST",
			body: "{}",
		});
		expect(res.status).toBe(N_200);
		const data = (await res.json()) as { ok: boolean };
		expect(data).toEqual({ ok: true });
	});
});

describe("RpcError", () => {
	it("has status and message", () => {
		const err = new RpcError(N_404, "Not found");
		expect(err.status).toBe(N_404);
		expect(err.message).toBe("Not found");
		expect(err).toBeInstanceOf(Error);
	});
});
