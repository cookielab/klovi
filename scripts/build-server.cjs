#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const { readFileSync, writeFileSync, chmodSync } = require("node:fs");
const { join } = require("node:path");

const { version } = require("../package.json");

let commitHash = "";
try {
  commitHash = execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
} catch {
  // git not available
}

execFileSync(
  "bun",
  [
    "build",
    "index.ts",
    "--target",
    "node",
    "--outfile",
    "dist/server.js",
    "--define",
    `process.env.KLOVI_VERSION=${JSON.stringify(version)}`,
    "--define",
    `process.env.KLOVI_COMMIT=${JSON.stringify(commitHash)}`,
  ],
  { stdio: "inherit" },
);

// Prepend shebang for direct CLI execution (package.json "bin" points here)
const serverPath = join(__dirname, "..", "dist", "server.js");
const content = readFileSync(serverPath, "utf-8");
writeFileSync(serverPath, `#!/usr/bin/env node\n${content}`);
chmodSync(serverPath, 0o755);
