import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmbeddedAsset } from "./http.ts";
import { matchRoute, serveEmbedded, serveStatic } from "./http.ts";

describe("matchRoute", () => {
  test("exact match with no params", () => {
    expect(matchRoute("/api/projects", "/api/projects")).toEqual({});
  });

  test("single param", () => {
    expect(matchRoute("/api/sessions/:sessionId", "/api/sessions/abc123")).toEqual({
      sessionId: "abc123",
    });
  });

  test("multiple params", () => {
    expect(
      matchRoute(
        "/api/sessions/:sessionId/subagents/:agentId",
        "/api/sessions/abc123/subagents/agent-1",
      ),
    ).toEqual({ sessionId: "abc123", agentId: "agent-1" });
  });

  test("non-matching route returns null", () => {
    expect(matchRoute("/api/projects", "/api/sessions")).toBeNull();
  });

  test("different segment count returns null", () => {
    expect(matchRoute("/api/projects", "/api/projects/extra")).toBeNull();
  });

  test("root path match", () => {
    expect(matchRoute("/", "/")).toEqual({});
  });

  test("param with encoded characters", () => {
    expect(matchRoute("/api/projects/:path", "/api/projects/foo%2Fbar")).toEqual({
      path: "foo%2Fbar",
    });
  });
});

describe("serveEmbedded", () => {
  test("serves root as index.html", () => {
    const assets = new Map<string, EmbeddedAsset>();
    assets.set("index.html", {
      data: new TextEncoder().encode("<html>Hello</html>"),
      contentType: "text/html; charset=utf-8",
    });

    const response = serveEmbedded("/", assets);
    expect(response).not.toBeNull();
  });

  test("serves non-root asset by path", () => {
    const assets = new Map<string, EmbeddedAsset>();
    assets.set("app.js", {
      data: new TextEncoder().encode("console.log('hi')"),
      contentType: "application/javascript; charset=utf-8",
    });

    const response = serveEmbedded("/app.js", assets);
    expect(response).not.toBeNull();
    expect(response!.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
  });

  test("SPA fallback for extensionless path", () => {
    const assets = new Map<string, EmbeddedAsset>();
    assets.set("index.html", {
      data: new TextEncoder().encode("<html>SPA</html>"),
      contentType: "text/html; charset=utf-8",
    });

    const response = serveEmbedded("/some/path", assets);
    expect(response).not.toBeNull();
  });

  test("returns null for missing asset with extension", () => {
    const assets = new Map<string, EmbeddedAsset>();
    expect(serveEmbedded("/missing.css", assets)).toBeNull();
  });

  test("returns null for extensionless path without index.html", () => {
    const assets = new Map<string, EmbeddedAsset>();
    expect(serveEmbedded("/some/path", assets)).toBeNull();
  });
});

describe("serveStatic", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  test("serves file from static directory", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "test.js"), "console.log('hello')");

    const response = await serveStatic("/test.js", tmpDir);
    expect(response).not.toBeNull();
    const text = await response!.text();
    expect(text).toBe("console.log('hello')");
    expect(response!.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
  });

  test("serves index.html for root path", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "index.html"), "<html>Home</html>");

    const response = await serveStatic("/", tmpDir);
    expect(response).not.toBeNull();
    const text = await response!.text();
    expect(text).toBe("<html>Home</html>");
  });

  test("SPA fallback for extensionless path", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "index.html"), "<html>SPA</html>");

    const response = await serveStatic("/some/route", tmpDir);
    expect(response).not.toBeNull();
    const text = await response!.text();
    expect(text).toBe("<html>SPA</html>");
  });

  test("returns null for missing file with extension", async () => {
    tmpDir = makeTmpDir();
    const response = await serveStatic("/missing.css", tmpDir);
    expect(response).toBeNull();
  });

  test("prevents path traversal", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "index.html"), "<html>OK</html>");

    const response = await serveStatic("/../../../etc/passwd", tmpDir);
    expect(response).toBeNull();
  });

  test("serves correct MIME types", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "style.css"), "body{}");
    writeFileSync(join(tmpDir, "data.json"), "{}");
    writeFileSync(join(tmpDir, "page.html"), "<html></html>");

    const css = await serveStatic("/style.css", tmpDir);
    expect(css!.headers.get("content-type")).toBe("text/css; charset=utf-8");

    const json = await serveStatic("/data.json", tmpDir);
    expect(json!.headers.get("content-type")).toBe("application/json; charset=utf-8");

    const html = await serveStatic("/page.html", tmpDir);
    expect(html!.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  test("unknown extension returns octet-stream", async () => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, "data.xyz"), "binary");

    const response = await serveStatic("/data.xyz", tmpDir);
    expect(response).not.toBeNull();
    expect(response!.headers.get("content-type")).toBe("application/octet-stream");
  });
});

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `klovi-http-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}
