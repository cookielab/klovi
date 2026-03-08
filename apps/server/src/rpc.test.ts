import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RPCError } from "./rpc-error.ts";
import { type KloviServer, startKloviServer } from "./server.ts";

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

  test("returns result for known method", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("commit");
  });

  test("returns 404 for unknown method", async () => {
    const res = await fetch(`${server.url}/api/rpc/nonexistent`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Unknown method");
  });

  test("acceptRisks returns ok", async () => {
    const res = await fetch(`${server.url}/api/rpc/acceptRisks`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data).toEqual({ ok: true });
  });
});

describe("RPCError", () => {
  test("has status and message", () => {
    const err = new RPCError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err).toBeInstanceOf(Error);
  });
});
