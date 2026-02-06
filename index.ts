import index from "./index.html";
import { handleProjects } from "./src/server/api/projects.ts";
import { handleSessions } from "./src/server/api/sessions.ts";
import { handleSession } from "./src/server/api/session.ts";

Bun.serve({
  port: 3000,
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
          return Response.json(
            { error: "project query parameter required" },
            { status: 400 }
          );
        }
        return handleSession(req.params.sessionId, project);
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("CCvie running at http://localhost:3000");
