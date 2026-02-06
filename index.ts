import index from "./index.html";
import { handleProjects } from "./src/server/api/projects.ts";
import { handleSession } from "./src/server/api/session.ts";
import { handleSessions } from "./src/server/api/sessions.ts";
import { handleSubAgent } from "./src/server/api/subagent.ts";

Bun.serve({
  port: 3583,
  routes: {
    "/": index,
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

console.log("Klovi running at http://localhost:3583");
