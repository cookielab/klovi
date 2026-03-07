import { resolve } from "node:path";
import { startKloviServer } from "./server.ts";
import { setVersion } from "./services/app-services.ts";

// Read version from package.json at startup
const pkg = await Bun.file(resolve(import.meta.dir, "../../package.json")).json();
setVersion(pkg.version ?? "0.0.0", pkg.commit ?? "");

const host = Bun.env["KLOVI_HOST"] ?? "127.0.0.1";
const port = Number(Bun.env["KLOVI_PORT"] ?? "3131");
const staticDir =
  Bun.env["KLOVI_STATIC_DIR"] ??
  resolve(import.meta.dir, "../../node_modules/@cookielab.io/klovi-web/dist");

const server = await startKloviServer({
  host,
  port,
  mode: "standalone",
  staticDir,
});

// biome-ignore lint/suspicious/noConsole: CLI output
console.log(`Klovi server listening on ${server.url}`);
