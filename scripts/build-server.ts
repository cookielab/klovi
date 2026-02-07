import { join } from "node:path";
import pkg from "../package.json";

let commitHash = "";
try {
  commitHash = (await Bun.$`git rev-parse --short HEAD`.text()).trim();
} catch {
  // git not available
}

await Bun.$`bun build index.ts --target node --outfile dist/server.js --define process.env.KLOVI_VERSION=${JSON.stringify(pkg.version)} --define process.env.KLOVI_COMMIT=${JSON.stringify(commitHash)}`;

// Prepend shebang for direct CLI execution (package.json "bin" points here)
const serverPath = join(import.meta.dir, "..", "dist", "server.js");
const content = await Bun.file(serverPath).text();
await Bun.write(serverPath, `#!/usr/bin/env node\n${content}`);

const { chmodSync } = await import("node:fs");
chmodSync(serverPath, 0o755);
