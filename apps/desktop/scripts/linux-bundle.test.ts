import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findNamedFiles, resolveLinuxLauncherPath } from "./linux-bundle.ts";

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }
    await Bun.$`rm -rf ${root}`;
  }
});

async function createTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

describe("findNamedFiles", () => {
  test("matches symbolic links to Linux wrapper libraries", async () => {
    const root = await createTempRoot("klovi-linux-bundle-");
    await mkdir(join(root, "bin"), { recursive: true });
    await writeFile(join(root, "bin", "libNativeWrapper.real.so"), "wrapper");
    await symlink(
      join(root, "bin", "libNativeWrapper.real.so"),
      join(root, "bin", "libNativeWrapper.so"),
    );

    const matches = await findNamedFiles(root, ["libNativeWrapper.so"]);

    expect(matches).toEqual([join(root, "bin", "libNativeWrapper.so")]);
  });
});

describe("resolveLinuxLauncherPath", () => {
  test("accepts a dist directory with launcher at the root", async () => {
    const root = await createTempRoot("klovi-linux-dist-");
    await writeFile(join(root, "launcher"), "#!/bin/sh\n");

    const launcherPath = await resolveLinuxLauncherPath(root);

    expect(launcherPath).toBe(join(root, "launcher"));
  });
});
