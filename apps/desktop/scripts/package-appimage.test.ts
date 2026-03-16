import { describe, expect, test } from "bun:test";
import {
  APPIMAGE_ARCH_MAP,
  APPIMAGE_DESKTOP_ENTRY_FILENAME,
  DESKTOP_ENTRY,
  parseArgs,
} from "./package-appimage.ts";

const STARTUP_WM_CLASS_LINE = ["StartupWMClass", "Klovi"].join("=");
const GNOME_WM_CLASS_LINE = ["X-GNOME-WMClass", "Klovi"].join("=");

describe("parseArgs", () => {
  test("parses all required arguments", () => {
    const argv = [
      "bun",
      "package-appimage.ts",
      "--tarball",
      "/tmp/bundle.tar.zst",
      "--arch",
      "x64",
      "--version",
      "1.2.3",
      "--output",
      "/tmp/Klovi.AppImage",
    ];
    const result = parseArgs(argv);
    expect(result).toEqual({
      tarball: "/tmp/bundle.tar.zst",
      arch: "x64",
      version: "1.2.3",
      output: "/tmp/Klovi.AppImage",
    });
  });

  test("accepts arm64 architecture", () => {
    const argv = [
      "bun",
      "package-appimage.ts",
      "--tarball",
      "/tmp/bundle.tar.zst",
      "--arch",
      "arm64",
      "--version",
      "1.0.0",
      "--output",
      "/tmp/out.AppImage",
    ];
    const result = parseArgs(argv);
    expect(result.arch).toBe("arm64");
  });

  test("matches workflow invocation args (no --appimagetool-arch)", () => {
    // The workflow calls: bun package-appimage.ts --tarball X --arch Y --version Z --output W
    const argv = [
      "bun",
      "package-appimage.ts",
      "--tarball",
      "artifacts/stable-linux-x64-Klovi.tar.zst",
      "--arch",
      "x64",
      "--version",
      "2.0.0",
      "--output",
      "Klovi-2.0.0-linux-amd64.AppImage",
    ];
    expect(() => parseArgs(argv)).not.toThrow();
  });
});

describe("APPIMAGE_ARCH_MAP", () => {
  test("maps x64 to x86_64", () => {
    expect(APPIMAGE_ARCH_MAP["x64"]).toBe("x86_64");
  });

  test("maps arm64 to aarch64", () => {
    expect(APPIMAGE_ARCH_MAP["arm64"]).toBe("aarch64");
  });
});

describe("linux desktop metadata", () => {
  test("uses the canonical desktop file identifier", () => {
    expect(APPIMAGE_DESKTOP_ENTRY_FILENAME).toBe("io.cookielab.klovi.desktop");
  });

  test("matches Klovi's Linux dock identity", () => {
    expect(DESKTOP_ENTRY).toContain("Name=Klovi");
    expect(DESKTOP_ENTRY).toContain("Icon=klovi");
    expect(DESKTOP_ENTRY).toContain(STARTUP_WM_CLASS_LINE);
    expect(DESKTOP_ENTRY).toContain(GNOME_WM_CLASS_LINE);
  });
});
