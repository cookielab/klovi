import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";

export interface Route {
  pattern: string;
  handler: (req: Request, params: Record<string, string>) => Response | Promise<Response>;
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i]!;
    const val = pathParts[i]!;
    if (pat.startsWith(":")) {
      params[pat.slice(1)] = val;
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

async function serveStatic(pathname: string, staticDir: string): Promise<Response | null> {
  const safePath = pathname.replace(/\.\./g, "");
  const filePath = join(staticDir, safePath === "/" ? "index.html" : safePath);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(data, {
      headers: { "content-type": contentType },
    });
  } catch {
    // File not found — SPA fallback to index.html
    if (safePath !== "/index.html" && !extname(safePath)) {
      const indexPath = join(staticDir, "index.html");
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

export function startServer(port: number, routes: Route[], staticDir: string): void {
  const hasStaticDir = existsSync(staticDir);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);
      const pathname = url.pathname;

      // Try API routes first
      for (const route of routes) {
        const params = matchRoute(route.pattern, pathname);
        if (params !== null) {
          const webReq = new Request(url.toString(), { method: req.method });
          const response = await route.handler(webReq, params);
          await writeResponse(res, response);
          return;
        }
      }

      // Static file serving
      if (hasStaticDir) {
        const response = await serveStatic(pathname, staticDir);
        if (response) {
          await writeResponse(res, response);
          return;
        }
      }

      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not Found");
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(port);
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
