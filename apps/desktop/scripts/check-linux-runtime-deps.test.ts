import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  buildLdLibraryPath,
  type CommandRunner,
  checkLinuxRuntimeDeps,
  isSkippableLddFailure,
  parseArgs,
  parseMissingDependencies,
} from "./check-linux-runtime-deps.ts";

const tempPaths: string[] = [];

afterEach(async () => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (path) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

async function makeTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(path);
  return path;
}

async function writeBundle(root: string): Promise<{
  launcherPath: string;
  localLibPath: string;
  wrapperPath: string;
}> {
  const launcherPath = join(root, "bin", "launcher");
  const wrapperPath = join(root, "bin", "libNativeWrapper.so");
  const localLibPath = join(root, "lib", "libasar.so");

  await Bun.write(launcherPath, "launcher");
  await Bun.write(wrapperPath, "wrapper");
  await Bun.write(localLibPath, "libasar");

  return { launcherPath, localLibPath, wrapperPath };
}

describe("parseArgs", () => {
  test("accepts a single bundle path", () => {
    expect(parseArgs(["bun", "check-linux-runtime-deps.ts", "/tmp/Klovi"])).toEqual({
      bundlePath: "/tmp/Klovi",
    });
  });
});

describe("parseMissingDependencies", () => {
  test("returns only unresolved shared libraries", () => {
    const output = [
      "\tlibwebkit2gtk-4.1.so.0 => not found",
      "\tlibasar.so => /tmp/Klovi/lib/libasar.so (0x1234)",
      "\tlibgtk-3.so.0 => not found",
      "",
    ].join("\n");

    expect(parseMissingDependencies(output)).toEqual(["libgtk-3.so.0", "libwebkit2gtk-4.1.so.0"]);
  });
});

describe("buildLdLibraryPath", () => {
  test("prepends unique bundle library paths", () => {
    expect(
      buildLdLibraryPath(["/bundle/bin", "/bundle/lib"], `/usr/lib${delimiter}/bundle/bin`),
    ).toBe(["/bundle/bin", "/bundle/lib", "/usr/lib"].join(delimiter));
  });
});

describe("isSkippableLddFailure", () => {
  test("treats non-dynamic binaries as skippable", () => {
    expect(isSkippableLddFailure("not a dynamic executable")).toBe(true);
    expect(isSkippableLddFailure("statically linked")).toBe(true);
    expect(isSkippableLddFailure("ldd: missing file")).toBe(false);
  });
});

describe("checkLinuxRuntimeDeps", () => {
  test("passes bundle-local library directories through LD_LIBRARY_PATH", async () => {
    const root = await makeTempDir("klovi-linux-runtime-pass-");
    const { launcherPath, localLibPath, wrapperPath } = await writeBundle(root);

    const calls: string[] = [];
    let observedLdLibraryPath = "";
    const runner: CommandRunner = ([command, targetPath = ""], env) => {
      expect(command).toBe("ldd");
      calls.push(targetPath);
      observedLdLibraryPath = env["LD_LIBRARY_PATH"] ?? "";

      return Promise.resolve({
        exitCode: 0,
        stderr: "",
        stdout: [
          `\tlibasar.so => ${localLibPath} (0x1234)`,
          "\tlibgtk-3.so.0 => /usr/lib/libgtk-3.so.0 (0x2345)",
          "",
        ].join("\n"),
      });
    };

    await expect(checkLinuxRuntimeDeps({ bundlePath: root }, runner)).resolves.toBeUndefined();
    expect(calls).toEqual([launcherPath, wrapperPath]);
    expect(observedLdLibraryPath.split(delimiter)).toEqual(
      expect.arrayContaining([join(root, "bin"), join(root, "lib")]),
    );
  });

  test("skips launcher binaries that ldd reports as non-dynamic", async () => {
    const root = await makeTempDir("klovi-linux-runtime-static-launcher-");
    const { launcherPath, localLibPath, wrapperPath } = await writeBundle(root);

    const runner: CommandRunner = ([, targetPath = ""]) => {
      if (targetPath === launcherPath) {
        return Promise.resolve({
          exitCode: 1,
          stderr: "not a dynamic executable",
          stdout: "",
        });
      }

      return Promise.resolve({
        exitCode: 0,
        stderr: "",
        stdout: [
          `\tlibasar.so => ${localLibPath} (0x1234)`,
          "\tlibgtk-3.so.0 => /usr/lib/libgtk-3.so.0 (0x2345)",
          "",
        ].join("\n"),
      });
    };

    await expect(checkLinuxRuntimeDeps({ bundlePath: root }, runner)).resolves.toBeUndefined();
    expect(wrapperPath).toContain("libNativeWrapper.so");
  });

  test("reports only unresolved system dependencies", async () => {
    const root = await makeTempDir("klovi-linux-runtime-fail-");
    const { localLibPath } = await writeBundle(root);

    const runner: CommandRunner = async () => ({
      exitCode: 0,
      stderr: "",
      stdout: [
        `\tlibasar.so => ${localLibPath} (0x1234)`,
        "\tlibwebkit2gtk-4.1.so.0 => not found",
        "",
      ].join("\n"),
    });

    await expect(checkLinuxRuntimeDeps({ bundlePath: root }, runner)).rejects.toThrow(
      "libwebkit2gtk-4.1.so.0",
    );
  });
});
