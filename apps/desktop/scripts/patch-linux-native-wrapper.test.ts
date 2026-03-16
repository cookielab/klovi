import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EXPECTED_WM_CLASS,
  parseArgs,
  patchLinuxNativeWrapper,
  UPSTREAM_WM_CLASS,
} from "./patch-linux-native-wrapper.ts";

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

async function writeWrapper(root: string, relativePath: string, contents: string): Promise<string> {
  const fullPath = join(root, relativePath);
  await Bun.write(fullPath, contents);
  return fullPath;
}

describe("parseArgs", () => {
  test("accepts a single bundle path", () => {
    expect(parseArgs(["bun", "patch-linux-native-wrapper.ts", "/tmp/Klovi"])).toEqual({
      bundlePath: "/tmp/Klovi",
    });
  });
});

describe("patchLinuxNativeWrapper", () => {
  test("replaces the upstream WM_CLASS bytes in nested libraries", async () => {
    const root = await makeTempDir("klovi-linux-patch-");
    const libraryPath = await writeWrapper(
      root,
      "bin/libNativeWrapper.so",
      `before-${UPSTREAM_WM_CLASS}-after`,
    );

    const results = await patchLinuxNativeWrapper({ bundlePath: root });

    expect(results).toEqual([
      expect.objectContaining({
        libraryPath,
        replacements: 1,
        status: "patched",
      }),
    ]);

    const patched = await Bun.file(libraryPath).text();
    expect(patched).not.toContain(UPSTREAM_WM_CLASS);
    expect(patched).toContain(EXPECTED_WM_CLASS);
  });

  test("is idempotent when the library is already patched", async () => {
    const root = await makeTempDir("klovi-linux-patch-idempotent-");
    const libraryPath = await writeWrapper(
      root,
      "bin/libNativeWrapper.so",
      `${EXPECTED_WM_CLASS}${"\0".repeat(UPSTREAM_WM_CLASS.length - EXPECTED_WM_CLASS.length)}`,
    );

    await expect(patchLinuxNativeWrapper({ bundlePath: root })).resolves.toEqual([
      expect.objectContaining({
        libraryPath,
        replacements: 0,
        status: "already_patched",
      }),
    ]);
  });

  test("fails when the target library does not contain the expected bytes", async () => {
    const root = await makeTempDir("klovi-linux-patch-missing-");
    await writeWrapper(root, "bin/libNativeWrapper.so", "no wm class here");

    await expect(patchLinuxNativeWrapper({ bundlePath: root })).rejects.toThrow(
      "Expected WM_CLASS bytes not found",
    );
  });
});
