import { readSync } from "node:fs";
import { handleProjects } from "./api/projects.ts";
import { handleSession } from "./api/session.ts";
import { handleSessions } from "./api/sessions.ts";
import { handleStats } from "./api/stats.ts";
import { handleSubAgent } from "./api/subagent.ts";
import { handleVersion } from "./api/version.ts";
import { getProjectsDir, setProjectsDir } from "./config.ts";
import type { Route } from "./http.ts";
import { appVersion } from "./version.ts";

export interface CliArgs {
  port: number;
  acceptRisks: boolean;
  showHelp: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const portIdx = argv.indexOf("--port");
  let port = 3583;
  if (portIdx !== -1) {
    const val = argv[portIdx + 1];
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

  const acceptRisks = argv.includes("--accept-risks");
  const showHelp = argv.includes("--help") || argv.includes("-h");

  const projectsDirIdx = argv.indexOf("--projects-dir");
  if (projectsDirIdx !== -1) {
    const dir = argv[projectsDirIdx + 1];
    if (!dir || dir.startsWith("-")) {
      console.error("Error: --projects-dir requires a path argument.");
      process.exit(1);
    }
    setProjectsDir(dir);
  }

  return { port, acceptRisks, showHelp };
}

export function showHelpText(): void {
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";

  console.log(`
Klovi — a web viewer for Claude Code sessions
${dim}by cookielab.io${reset}

Usage:
  klovi [options]

Options:
  --accept-risks           Skip the startup security warning
  --port <number>          Server port (default: 3583)
  --projects-dir <path>    Override the Claude projects directory
  -h, --help               Show this help message

The server runs on http://localhost:3583 by default.
`);
}

export function printStartupBanner(port: number): void {
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const green = "\x1b[32m";
  const reset = "\x1b[0m";

  const version = appVersion.version;
  const url = `http://localhost:${port}`;

  const line1 = `   ${bold}${green}{K>  Klovi${reset} ${dim}v${version}${reset}`;
  const line2 = `        ${dim}by cookielab.io${reset}`;
  const line3 = `   Running at ${bold}${url}${reset}`;

  // Box width (inner content area)
  const w = 42;
  const pad = (s: string) => {
    // Strip ANSI codes to measure visible length
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape sequences
    const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
    const remaining = w - visible.length;
    return `${s}${" ".repeat(Math.max(0, remaining))}`;
  };

  const top = `${dim}\u256d${"\u2500".repeat(w)}\u256e${reset}`;
  const bot = `${dim}\u2570${"\u2500".repeat(w)}\u256f${reset}`;
  const empty = `${dim}\u2502${reset}${" ".repeat(w)}${dim}\u2502${reset}`;
  const row = (s: string) => `${dim}\u2502${reset}${pad(s)}${dim}\u2502${reset}`;

  console.log(top);
  console.log(empty);
  console.log(row(line1));
  console.log(row(line2));
  console.log(empty);
  console.log(row(line3));
  console.log(empty);
  console.log(bot);
}

export function promptSecurityWarning(port: number): void {
  const resolvedDir = getProjectsDir();
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

export function createRoutes(): Route[] {
  return [
    { pattern: "/api/version", handler: () => handleVersion() },
    { pattern: "/api/stats", handler: () => handleStats() },
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
  ];
}
