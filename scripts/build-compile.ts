import { readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import pkg from "../package.json";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

const DEFAULT_TARGETS = ["bun-darwin-arm64", "bun-darwin-x64", "bun-linux-x64", "bun-linux-arm64"];

// --- Parse CLI args ---
const targetIdx = process.argv.indexOf("--target");
let targets: string[];
if (targetIdx !== -1 && process.argv[targetIdx + 1]) {
  targets = process.argv[targetIdx + 1]!.split(",");
} else {
  targets = DEFAULT_TARGETS;
}

// --- Resolve version ---
let version = pkg.version;
if (version === "0.0.0") {
  try {
    version = (await Bun.$`git describe --tags`.text()).trim();
  } catch {
    version = "dev";
  }
}

let commitHash = "";
try {
  commitHash = (await Bun.$`git rev-parse --short HEAD`.text()).trim();
} catch {
  // git not available
}

// --- Step 1: Build frontend ---
console.log("Building frontend...");
await Bun.$`bun run build:frontend`;

// --- Step 2: Scan dist/public/ and generate embedded assets module ---
const publicDir = join(import.meta.dir, "..", "dist", "public");

function scanDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...scanDir(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const allFiles = scanDir(publicDir);

let embeddedCode = `import { Buffer } from "node:buffer";\n`;
embeddedCode += `import type { EmbeddedAsset } from "../src/server/http.ts";\n\n`;
embeddedCode += `export const embeddedAssets = new Map<string, EmbeddedAsset>([\n`;

for (const filePath of allFiles) {
  const relPath = relative(publicDir, filePath).replaceAll("\\", "/");
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileData = await Bun.file(filePath).arrayBuffer();
  const base64 = Buffer.from(fileData).toString("base64");

  embeddedCode += `  [${JSON.stringify(relPath)}, {\n`;
  embeddedCode += `    data: Buffer.from(${JSON.stringify(base64)}, "base64"),\n`;
  embeddedCode += `    contentType: ${JSON.stringify(contentType)},\n`;
  embeddedCode += `  }],\n`;
}

embeddedCode += `]);\n`;

const embeddedPath = join(import.meta.dir, "..", "dist", "embedded-assets.ts");
await Bun.write(embeddedPath, embeddedCode);
console.log(`Generated embedded assets (${allFiles.length} files) → dist/embedded-assets.ts`);

// --- Step 3: Generate compile entry point ---
const entryCode = `import { existsSync } from "node:fs";
import { createRoutes, parseCliArgs, promptSecurityWarning, showHelpText } from "../src/server/cli.ts";
import { getProjectsDir } from "../src/server/config.ts";
import { startServer } from "../src/server/http.ts";
import { embeddedAssets } from "./embedded-assets.ts";

const { port, acceptRisks, showHelp } = parseCliArgs(process.argv);

if (showHelp) {
  showHelpText();
  process.exit(0);
}

const resolvedDir = getProjectsDir();
if (!existsSync(resolvedDir)) {
  console.error(\`Error: projects directory not found: \${resolvedDir}\`);
  console.error("Hint: use --projects-dir <path> to specify a custom location.");
  process.exit(1);
}

if (!acceptRisks) {
  promptSecurityWarning(port);
}

startServer(port, createRoutes(), "", embeddedAssets);

console.log(\`Klovi running at http://localhost:\${port}\`);
`;

const entryPath = join(import.meta.dir, "..", "dist", "compile-entry.ts");
await Bun.write(entryPath, entryCode);
console.log("Generated compile entry point → dist/compile-entry.ts");

// --- Step 4: Compile for each target ---
for (const target of targets) {
  const outfile = join(import.meta.dir, "..", "dist", `klovi-${target}`);
  console.log(`Compiling for ${target}...`);
  await Bun.$`bun build --compile ${entryPath} --target ${target} --outfile ${outfile} --define process.env.KLOVI_VERSION=${JSON.stringify(version)} --define process.env.KLOVI_COMMIT=${JSON.stringify(commitHash)}`;
  console.log(`  → dist/klovi-${target}`);
}

console.log("Done!");
