import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type KloviServer, startKloviServer } from "./server.ts";

/**
 * Integration test: real server + HTTP client round-trip.
 * This tests the seam between apps/server and apps/web's createHttpClient.
 */

describe("server + HTTP client integration", () => {
  let server: KloviServer;

  beforeAll(async () => {
    server = await startKloviServer({
      host: "127.0.0.1",
      port: 0,
      version: "1.2.3",
      commit: "abc123",
    });
  });

  afterAll(() => {
    server?.stop();
  });

  test("getVersion round-trip returns set version", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { version: string; commit: string };
    expect(data.version).toBe("1.2.3");
    expect(data.commit).toBe("abc123");
  });

  test("isFirstLaunch returns firstLaunch boolean", async () => {
    const res = await fetch(`${server.url}/api/rpc/isFirstLaunch`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { firstLaunch: boolean };
    expect(typeof data.firstLaunch).toBe("boolean");
  });

  test("getProjects returns projects array", async () => {
    const res = await fetch(`${server.url}/api/rpc/getProjects`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { projects: unknown[] };
    expect(Array.isArray(data.projects)).toBe(true);
  });

  test("getPluginSettings returns plugins array", async () => {
    const res = await fetch(`${server.url}/api/rpc/getPluginSettings`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { plugins: unknown[] };
    expect(Array.isArray(data.plugins)).toBe(true);
  });

  test("getGeneralSettings returns showSecurityWarning", async () => {
    const res = await fetch(`${server.url}/api/rpc/getGeneralSettings`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { showSecurityWarning: boolean };
    expect(typeof data.showSecurityWarning).toBe("boolean");
  });

  test("GET method returns 404 for RPC endpoint", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "GET",
    });
    expect(res.status).toBe(404);
  });

  test("CORS headers not required for same-origin requests", async () => {
    const res = await fetch(`${server.url}/api/rpc/getVersion`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(200);
  });
});
