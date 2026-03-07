import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type KloviServer, startKloviServer } from "./server.ts";

const URL_PATTERN = /^http:\/\/127\.0\.0\.1:\d+$/;

describe("startKloviServer", () => {
  let server: KloviServer;

  beforeAll(async () => {
    server = await startKloviServer({ host: "127.0.0.1", port: 0 });
  });

  afterAll(() => {
    server?.stop();
  });

  test("returns a URL", () => {
    expect(server.url).toMatch(URL_PATTERN);
  });

  test("POST /api/rpc/getVersion returns version info", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("commit");
  });

  test("POST /api/rpc/acceptRisks returns ok", async () => {
    const res = await fetch(`${server.url}/api/rpc/acceptRisks`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  test("POST /api/rpc/unknown returns 404", async () => {
    const res = await fetch(`${server.url}/api/rpc/unknownMethod`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/rpc/ without method returns 400", async () => {
    const res = await fetch(`${server.url}/api/rpc/`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  test("POST with invalid JSON returns 400", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "not json{{{",
    });
    expect(res.status).toBe(400);
  });

  test("GET / returns 404 when no staticDir", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(404);
  });
});
