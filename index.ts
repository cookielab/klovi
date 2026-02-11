import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRoutes,
  parseCliArgs,
  printStartupBanner,
  promptSecurityWarning,
  showHelpText,
} from "./src/server/cli.ts";
import { getClaudeCodeDir } from "./src/server/config.ts";
import { startServer } from "./src/server/http.ts";

const { port, acceptRisks, showHelp } = parseCliArgs(process.argv);

if (showHelp) {
  showHelpText();
  process.exit(0);
}

const resolvedDir = getClaudeCodeDir();
if (!existsSync(resolvedDir)) {
  console.error(`Error: Claude Code directory not found: ${resolvedDir}`);
  console.error("Hint: use --claude-code-dir <path> to specify a custom location.");
  process.exit(1);
}

if (!acceptRisks) {
  promptSecurityWarning(port);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// When bundled into dist/server.js, __dirname is "dist/" so public/ is a sibling.
// When running from source (bun index.ts), __dirname is project root so public/ is in dist/public/.
const staticDir = existsSync(join(__dirname, "public", "index.html"))
  ? join(__dirname, "public")
  : join(__dirname, "dist", "public");

startServer(port, createRoutes(), staticDir);

printStartupBanner(port);
