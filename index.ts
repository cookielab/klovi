import { existsSync, readSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleProjects } from "./src/server/api/projects.ts";
import { handleSession } from "./src/server/api/session.ts";
import { handleSessions } from "./src/server/api/sessions.ts";
import { handleSubAgent } from "./src/server/api/subagent.ts";
import { handleVersion } from "./src/server/api/version.ts";
import { getProjectsDir, setProjectsDir } from "./src/server/config.ts";
import { startServer } from "./src/server/http.ts";

const portIdx = process.argv.indexOf("--port");
let port = 3583;
if (portIdx !== -1) {
  const val = process.argv[portIdx + 1];
  if (!val || val.startsWith("-")) {
    console.error("Error: --port requires a number argument.");
    process.exit(1);
  }
  port = Number.parseInt(val, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error("Error: --port must be a valid port number (1-65535).");
    process.exit(1);
  }
}

const acceptRisks = process.argv.includes("--accept-risks");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Klovi — a web viewer for Claude Code sessions

Usage:
  klovi [options]

Options:
  --accept-risks           Skip the startup security warning
  --port <number>          Server port (default: 3583)
  --projects-dir <path>    Override the Claude projects directory
  -h, --help               Show this help message

The server runs on http://localhost:3583 by default.
`);
  process.exit(0);
}

const projectsDirIdx = process.argv.indexOf("--projects-dir");
if (projectsDirIdx !== -1) {
  const dir = process.argv[projectsDirIdx + 1];
  if (!dir || dir.startsWith("-")) {
    console.error("Error: --projects-dir requires a path argument.");
    process.exit(1);
  }
  setProjectsDir(dir);
}

const resolvedDir = getProjectsDir();
if (!existsSync(resolvedDir)) {
  console.error(`Error: projects directory not found: ${resolvedDir}`);
  console.error("Hint: use --projects-dir <path> to specify a custom location.");
  process.exit(1);
}

if (!acceptRisks) {
  const yellow = "\x1b[33m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";
  const dim = "\x1b[2m";

  console.log("");
  console.log(`${yellow}${bold}  ⚠  WARNING${reset}`);
  console.log("");
  console.log(`  Klovi reads Claude Code session history from ${resolvedDir}.`);
  console.log("  Session data may contain sensitive information such as API keys,");
  console.log("  credentials, or private code snippets.");
  console.log("");
  console.log(`  The server will expose this data on ${bold}http://localhost:${port}${reset}.`);
  console.log("");
  console.log(`  ${dim}To skip this prompt, pass --accept-risks${reset}`);
  console.log("");

  process.stdout.write("  Continue? (y/N) ");

  const buf = Buffer.alloc(1024);
  const bytesRead = readSync(0, buf, 0, 1024, null);
  const answer = buf.toString("utf-8", 0, bytesRead).trim().toLowerCase();

  if (answer !== "y" && answer !== "yes") {
    console.log("  Aborted.");
    process.exit(0);
  }

  console.log("");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// When bundled into dist/server.js, __dirname is "dist/" so public/ is a sibling.
// When running from source (bun index.ts), __dirname is project root so public/ is in dist/public/.
const staticDir = existsSync(join(__dirname, "public", "index.html"))
  ? join(__dirname, "public")
  : join(__dirname, "dist", "public");

startServer(
  port,
  [
    { pattern: "/api/version", handler: () => handleVersion() },
    { pattern: "/api/projects", handler: () => handleProjects() },
    {
      pattern: "/api/projects/:encodedPath/sessions",
      handler: (_req, p) => handleSessions(p.encodedPath!),
    },
    {
      pattern: "/api/sessions/:sessionId",
      handler: (req, p) => {
        const project = new URL(req.url).searchParams.get("project");
        if (!project) {
          return Response.json({ error: "project query parameter required" }, { status: 400 });
        }
        return handleSession(p.sessionId!, project);
      },
    },
    {
      pattern: "/api/sessions/:sessionId/subagents/:agentId",
      handler: (req, p) => {
        const project = new URL(req.url).searchParams.get("project");
        if (!project) {
          return Response.json({ error: "project query parameter required" }, { status: 400 });
        }
        return handleSubAgent(p.sessionId!, p.agentId!, project);
      },
    },
  ],
  staticDir,
);

console.log(`Klovi running at http://localhost:${port}`);
