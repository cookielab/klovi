import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getClaudeCodeDir } from "./src/plugins/config.ts";
import {
  createRoutes,
  parseCliArgs,
  printStartupBanner,
  promptSecurityWarning,
  showHelpText,
} from "./src/server/cli.ts";
import { startServer } from "./src/server/http.ts";

const { port, host, acceptRisks, showHelp } = parseCliArgs(process.argv);

if (showHelp) {
  showHelpText();
  process.exit(0);
}

const resolvedDir = getClaudeCodeDir();
if (!existsSync(resolvedDir)) {
  console.warn(`Warning: Claude Code directory not found: ${resolvedDir}`);
}

if (!acceptRisks) {
  promptSecurityWarning(port, host);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// When bundled into dist/server.js, __dirname is "dist/" so public/ is a sibling.
// When running from source (bun index.ts), __dirname is project root so public/ is in dist/public/.
const staticDir = existsSync(join(__dirname, "public", "index.html"))
  ? join(__dirname, "public")
  : join(__dirname, "dist", "public");

startServer(port, host, createRoutes(), staticDir);

printStartupBanner(port, host);
