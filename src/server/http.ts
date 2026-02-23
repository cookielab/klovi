import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

export interface Route {
  pattern: string;
  handler: (req: Request, params: Record<string, string>) => Response | Promise<Response>;
}

export interface EmbeddedAsset {
  data: Uint8Array;
  contentType: string;
}

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i]!;
    const val = pathParts[i]!;
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = decodeURIComponent(val);
    } else if (pat !== val) {
      return null;
    }
  }
  return params;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

export async function serveStatic(pathname: string, staticDir: string): Promise<Response | null> {
  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  const absoluteStaticDir = resolve(staticDir);
  const absoluteFilePath = resolve(staticDir, requestedPath);

  // Prevent path traversal attacks
  if (
    !absoluteFilePath.startsWith(absoluteStaticDir + sep) &&
    absoluteFilePath !== absoluteStaticDir
  ) {
    return null;
  }

  try {
    const data = await readFile(absoluteFilePath);
    const ext = extname(absoluteFilePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(data, {
      headers: { "content-type": contentType },
    });
  } catch {
    // File not found — SPA fallback to index.html
    if (pathname !== "/index.html" && !extname(pathname)) {
      const indexPath = resolve(staticDir, "index.html");
      try {
        const data = await readFile(indexPath);
        return new Response(data, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function serveEmbedded(
  pathname: string,
  assets: Map<string, EmbeddedAsset>,
): Response | null {
  const key = pathname === "/" ? "index.html" : pathname.slice(1);
  const asset = assets.get(key);
  if (asset) {
    return new Response(asset.data.buffer as ArrayBuffer, {
      headers: { "content-type": asset.contentType },
    });
  }

  // SPA fallback to index.html for extensionless paths
  if (!extname(pathname)) {
    const index = assets.get("index.html");
    if (index) {
      return new Response(index.data.buffer as ArrayBuffer, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  return null;
}

async function handleRequest(
  pathname: string,
  url: URL,
  method: string,
  routes: Route[],
  staticDir: string,
  hasStaticDir: boolean,
  embeddedAssets?: Map<string, EmbeddedAsset>,
): Promise<Response> {
  // Try API routes first
  for (const route of routes) {
    const params = matchRoute(route.pattern, pathname);
    if (params !== null) {
      const webReq = new Request(url.toString(), { method });
      return route.handler(webReq, params);
    }
  }

  // Serve from embedded assets (compiled binary) or filesystem
  if (embeddedAssets) {
    const response = serveEmbedded(pathname, embeddedAssets);
    if (response) return response;
  } else if (hasStaticDir) {
    const response = await serveStatic(pathname, staticDir);
    if (response) return response;
  }

  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export function startServer(
  port: number,
  host: string,
  routes: Route[],
  staticDir: string,
  embeddedAssets?: Map<string, EmbeddedAsset>,
): void {
  const hasStaticDir = !embeddedAssets && existsSync(staticDir);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);
      const response = await handleRequest(
        url.pathname,
        url,
        req.method!,
        routes,
        staticDir,
        hasStaticDir,
        embeddedAssets,
      );
      await writeResponse(res, response);
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(port, host);
}

async function writeResponse(
  res: import("node:http").ServerResponse,
  webResponse: Response,
): Promise<void> {
  const headers: Record<string, string> = {};
  webResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webResponse.status, headers);

  const body = await webResponse.arrayBuffer();
  res.end(Buffer.from(body));
}
