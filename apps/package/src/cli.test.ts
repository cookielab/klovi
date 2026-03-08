import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

describe("CLI smoke tests", () => {
  const cliPath = resolve(import.meta.dir, "cli.ts");
  const serverPath = resolve(import.meta.dir, "server.ts");

  test("cli.ts file exists", async () => {
    const file = Bun.file(cliPath);
    expect(await file.exists()).toBe(true);
  });

  test("cli.ts imports server module", async () => {
    const content = await Bun.file(cliPath).text();
    expect(content).toContain("startKloviPackageServer");
  });

  test("server.ts exports startKloviPackageServer", async () => {
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
    expect(pkg.exports?.["./server"]).toBe("./src/server.ts");
  });
});
