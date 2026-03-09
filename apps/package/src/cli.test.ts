import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveCliConfig } from "./cli-config.ts";

describe("CLI smoke tests", () => {
  const cliPath = resolve(import.meta.dir, "cli.ts");
  const serverPath = resolve(import.meta.dir, "server.ts");

  test("cli.ts file exists", async () => {
    const file = Bun.file(cliPath);
    expect(await file.exists()).toBe(true);
  });

  test("cli.ts imports startKloviPackageServer for internal composition", async () => {
    const content = await Bun.file(cliPath).text();
    expect(content).toContain("startKloviPackageServer");
  });

  test("cli.ts uses resolveCliConfig for environment-backed runtime config", async () => {
    const content = await Bun.file(cliPath).text();
    expect(content).toContain("resolveCliConfig");
  });

  test("server.ts exports startKloviServer as public contract", async () => {
    const serverModule = await import(serverPath);
    expect(typeof serverModule.startKloviServer).toBe("function");
  });

  test("server.ts exports startKloviPackageServer for internal use", async () => {
    const serverModule = await import(serverPath);
    expect(typeof serverModule.startKloviPackageServer).toBe("function");
  });

  test("package.json bin points to cli.ts", async () => {
    const pkgPath = resolve(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();
    expect(pkg.bin?.klovi).toBe("./dist/cli.js");
  });

  test("package.json exports server entry", async () => {
    const pkgPath = resolve(import.meta.dir, "../package.json");
    const pkg = await Bun.file(pkgPath).json();
    expect(pkg.exports?.["./server"]).toBe("./dist/server.js");
  });

  test("resolveCliConfig supports KLOVI_SETTINGS_PATH", () => {
    const config = resolveCliConfig(resolve(import.meta.dir, "src-under-test"), ["bun", "cli.ts"], {
      KLOVI_SETTINGS_PATH: "/tmp/klovi-settings.json",
    });
    expect(config.settingsPath).toBe("/tmp/klovi-settings.json");
  });
});
