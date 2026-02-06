import index from "./index.html";
import { handleProjects } from "./src/server/api/projects.ts";
import { handleSession } from "./src/server/api/session.ts";
import { handleSessions } from "./src/server/api/sessions.ts";
import { handleSubAgent } from "./src/server/api/subagent.ts";
import { handleVersion } from "./src/server/api/version.ts";

const PORT = 3583;
const isDevMode = process.argv.includes("--hot");
const acceptRisks = process.argv.includes("--accept-risks");

if (!isDevMode && !acceptRisks) {
  const yellow = "\x1b[33m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";
  const dim = "\x1b[2m";

  console.log("");
  console.log(`${yellow}${bold}  ⚠  WARNING${reset}`);
  console.log("");
  console.log("  Klovi reads Claude Code session history from ~/.claude/projects/.");
  console.log("  Session data may contain sensitive information such as API keys,");
  console.log("  credentials, or private code snippets.");
  console.log("");
  console.log(`  The server will expose this data on ${bold}http://localhost:${PORT}${reset}.`);
  console.log("");
  console.log(`  ${dim}To skip this prompt, pass --accept-risks${reset}`);
  console.log("");

  process.stdout.write("  Continue? (y/N) ");

  const buf = Buffer.alloc(1024);
  const bytesRead = require("node:fs").readSync(0, buf, 0, 1024, null) as number;
  const answer = buf.toString("utf-8", 0, bytesRead).trim().toLowerCase();

  if (answer !== "y" && answer !== "yes") {
    console.log("  Aborted.");
    process.exit(0);
  }

  console.log("");
}

Bun.serve({
  port: PORT,
  routes: {
    "/": index,
    "/api/version": {
      GET: () => handleVersion(),
    },
    "/api/projects": {
      GET: () => handleProjects(),
    },
    "/api/projects/:encodedPath/sessions": {
      GET: (req) => handleSessions(req.params.encodedPath),
    },
    "/api/sessions/:sessionId": {
      GET: (req) => {
        const url = new URL(req.url);
        const project = url.searchParams.get("project");
        if (!project) {
          return Response.json({ error: "project query parameter required" }, { status: 400 });
        }
        return handleSession(req.params.sessionId, project);
      },
    },
    "/api/sessions/:sessionId/subagents/:agentId": {
      GET: (req) => {
        const url = new URL(req.url);
        const project = url.searchParams.get("project");
        if (!project) {
          return Response.json({ error: "project query parameter required" }, { status: 400 });
        }
        return handleSubAgent(req.params.sessionId, req.params.agentId, project);
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Klovi running at http://localhost:${PORT}`);
