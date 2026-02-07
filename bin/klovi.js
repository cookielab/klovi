#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

try {
  execFileSync("bun", [join(__dirname, "..", "index.ts"), ...process.argv.slice(2)], { stdio: "inherit" });
} catch (e) {
  if (e.status != null) process.exit(e.status);
  console.error("Klovi requires the Bun runtime. Install it from https://bun.sh");
  process.exit(1);
}
