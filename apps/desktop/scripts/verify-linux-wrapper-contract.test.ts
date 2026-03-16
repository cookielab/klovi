import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectLayout,
  EXPECTED_LINUX_APP_IDENTIFIER,
  EXPECTED_LINUX_APP_NAME,
  EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME,
  EXPECTED_LINUX_ICON_BASENAME,
  METADATA_FILENAMES,
  parseArgs,
  parseDesktopEntry,
  verifyLinuxWrapperContract,
} from "./verify-linux-wrapper-contract.ts";

const tempPaths: string[] = [];
const STARTUP_WM_CLASS_LINE = ["StartupWMClass", "Klovi"].join("=");
const DESKTOP_ENTRY_FIXTURE = [
  "[Desktop Entry]",
  `Name=${EXPECTED_LINUX_APP_NAME}`,
  STARTUP_WM_CLASS_LINE,
  "",
].join("\n");

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

async function writeBundle(root: string, metadataFilename: string = "version.json"): Promise<void> {
  await Bun.write(
    join(root, "Resources", metadataFilename),
    JSON.stringify({
      version: "1.2.3",
      hash: "abc123",
      channel: "stable",
      name: EXPECTED_LINUX_APP_NAME,
      identifier: EXPECTED_LINUX_APP_IDENTIFIER,
    }),
  );
  await Bun.write(join(root, EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME), DESKTOP_ENTRY_FIXTURE);
  await Bun.write(join(root, "Resources", "appIcon.png"), "png");
  await Bun.write(join(root, "Resources", "app", "icon.png"), "png");
}

describe("parseArgs", () => {
  test("accepts a single bundle path", () => {
    expect(parseArgs(["bun", "verify-linux-wrapper-contract.ts", "/tmp/Klovi"])).toEqual({
      bundlePath: "/tmp/Klovi",
    });
  });
});

describe("parseDesktopEntry", () => {
  test("parses desktop keys and values", () => {
    const entry = parseDesktopEntry(`[Desktop Entry]\nName=Klovi\nStartupWMClass=Klovi\n`);
    expect(entry.get("Name")).toBe("Klovi");
    expect(entry.get("StartupWMClass")).toBe("Klovi");
  });
});

describe("detectLayout", () => {
  for (const metadataFilename of METADATA_FILENAMES) {
    test(`detects a normalized Linux bundle with ${metadataFilename}`, async () => {
      const root = await makeTempDir("klovi-linux-bundle-");
      await writeBundle(root, metadataFilename);

      await expect(detectLayout(root)).resolves.toEqual({
        inputRoot: root,
        bundleRoot: root,
        desktopRoot: root,
        isAppDir: false,
      });
    });

    test(`detects an AppDir layout with ${metadataFilename}`, async () => {
      const root = await makeTempDir("klovi-linux-appdir-");
      const bundleRoot = join(root, "usr", "lib", EXPECTED_LINUX_ICON_BASENAME);
      await writeBundle(bundleRoot, metadataFilename);
      await Bun.write(join(root, EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME), DESKTOP_ENTRY_FIXTURE);
      await Bun.write(join(root, `${EXPECTED_LINUX_ICON_BASENAME}.png`), "png");
      await Bun.write(join(root, ".DirIcon"), "png");

      await expect(detectLayout(root)).resolves.toEqual({
        inputRoot: root,
        bundleRoot,
        desktopRoot: root,
        isAppDir: true,
      });
    });
  }
});

describe("linux wrapper contract", () => {
  for (const metadataFilename of METADATA_FILENAMES) {
    test(`accepts a normalized bundle with ${metadataFilename}`, async () => {
      const root = await makeTempDir("klovi-linux-contract-");
      await writeBundle(root, metadataFilename);

      await expect(verifyLinuxWrapperContract({ bundlePath: root })).resolves.toBeUndefined();
    });

    test(`accepts an AppDir with ${metadataFilename}`, async () => {
      const root = await makeTempDir("klovi-linux-appdir-contract-");
      const bundleRoot = join(root, "usr", "lib", EXPECTED_LINUX_ICON_BASENAME);
      await writeBundle(bundleRoot, metadataFilename);
      await Bun.write(join(root, EXPECTED_LINUX_DESKTOP_ENTRY_FILENAME), DESKTOP_ENTRY_FIXTURE);
      await Bun.write(join(root, `${EXPECTED_LINUX_ICON_BASENAME}.png`), "png");
      await Bun.write(join(root, ".DirIcon"), "png");

      await expect(verifyLinuxWrapperContract({ bundlePath: root })).resolves.toBeUndefined();
    });
  }
});
