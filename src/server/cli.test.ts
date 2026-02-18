import { describe, expect, test } from "bun:test";
import { createRoutes, parseCliArgs } from "./cli.ts";

describe("parseCliArgs", () => {
  test("returns defaults with no arguments", () => {
    const result = parseCliArgs([]);
    expect(result.port).toBe(3583);
    expect(result.host).toBe("127.0.0.1");
    expect(result.acceptRisks).toBe(false);
    expect(result.showHelp).toBe(false);
  });

  test("parses --port", () => {
    const result = parseCliArgs(["--port", "8080"]);
    expect(result.port).toBe(8080);
  });

  test("parses --host", () => {
    const result = parseCliArgs(["--host", "localhost"]);
    expect(result.host).toBe("localhost");
  });

  test("parses --accept-risks", () => {
    const result = parseCliArgs(["--accept-risks"]);
    expect(result.acceptRisks).toBe(true);
  });

  test("parses --help", () => {
    const result = parseCliArgs(["--help"]);
    expect(result.showHelp).toBe(true);
  });

  test("parses -h", () => {
    const result = parseCliArgs(["-h"]);
    expect(result.showHelp).toBe(true);
  });

  test("parses multiple flags together", () => {
    const result = parseCliArgs(["--accept-risks", "--host", "localhost", "--port", "9000", "--help"]);
    expect(result.port).toBe(9000);
    expect(result.host).toBe("localhost");
    expect(result.acceptRisks).toBe(true);
    expect(result.showHelp).toBe(true);
  });

  test("parses --codex-cli-dir without crashing", () => {
    const result = parseCliArgs(["--codex-cli-dir", "/tmp/codex"]);
    expect(result.port).toBe(3583);
  });

  test("parses --opencode-dir without crashing", () => {
    const result = parseCliArgs(["--opencode-dir", "/tmp/opencode"]);
    expect(result.port).toBe(3583);
  });

  test("parses all tool dir flags together", () => {
    const result = parseCliArgs([
      "--claude-code-dir",
      "/tmp/claude",
      "--codex-cli-dir",
      "/tmp/codex",
      "--opencode-dir",
      "/tmp/opencode",
    ]);
    expect(result.port).toBe(3583);
  });
});

describe("createRoutes", () => {
  test("returns all expected API routes", () => {
    const routes = createRoutes();
    const patterns = routes.map((r) => r.pattern);

    expect(patterns).toContain("/api/version");
    expect(patterns).toContain("/api/stats");
    expect(patterns).toContain("/api/search/sessions");
    expect(patterns).toContain("/api/projects");
    expect(patterns).toContain("/api/projects/:encodedPath/sessions");
    expect(patterns).toContain("/api/sessions/:sessionId");
    expect(patterns).toContain("/api/sessions/:sessionId/subagents/:agentId");
  });

  test("returns 7 routes", () => {
    const routes = createRoutes();
    expect(routes).toHaveLength(7);
  });

  test("session route requires project query parameter", async () => {
    const routes = createRoutes();
    const sessionRoute = routes.find((r) => r.pattern === "/api/sessions/:sessionId")!;

    const req = new Request("http://localhost/api/sessions/abc123");
    const response = await sessionRoute.handler(req, { sessionId: "abc123" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("project query parameter required");
  });

  test("subagent route requires project query parameter", async () => {
    const routes = createRoutes();
    const subagentRoute = routes.find(
      (r) => r.pattern === "/api/sessions/:sessionId/subagents/:agentId",
    )!;

    const req = new Request("http://localhost/api/sessions/abc123/subagents/agent-1");
    const response = await subagentRoute.handler(req, {
      sessionId: "abc123",
      agentId: "agent-1",
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("project query parameter required");
  });
});
