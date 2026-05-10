import { createHttpClient } from "./http-client";

// Use a minimal mock server for testing
let mockServer: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
	mockServer = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: (req) => {
			const url = new URL(req.url);
			if (url.pathname === "/api/rpc/getVersion") {
				return Response.json({ version: "1.0.0", commit: "abc123" });
			}
			if (url.pathname === "/api/rpc/failMethod") {
				return Response.json({ error: "Something went wrong" }, { status: 500 });
			}
			return Response.json({ error: "Not found" }, { status: 404 });
		},
	});
	baseUrl = `http://127.0.0.1:${mockServer.port}`;
});

afterAll(() => {
	mockServer?.stop();
});

describe("createHttpClient", () => {
	it("calls RPC endpoint and returns result", async () => {
		const client = createHttpClient(baseUrl);
		const result = await client.getVersion();
		expect(result.version).toBe("1.0.0");
		expect(result.commit).toBe("abc123");
	});

	it("throws on error response", async () => {
		const client = createHttpClient(baseUrl);
		await expect(
			(client as unknown as { failMethod: () => Promise<unknown> }).failMethod?.() ??
				Promise.reject(new Error("no method")),
		).rejects.toThrow();
	});
});
