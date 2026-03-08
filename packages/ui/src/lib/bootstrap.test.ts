import { describe, expect, test } from "bun:test";

/**
 * Tests that the shared app bootstrap exports the expected Arch2 interfaces.
 */

describe("bootstrap exports", () => {
  test("exports mountKloviApp function", async () => {
    const mod = await import("../bootstrap.tsx");
    expect(typeof mod.mountKloviApp).toBe("function");
  });

  test("exports createHttpClient function", async () => {
    const mod = await import("../bootstrap.tsx");
    expect(typeof mod.createHttpClient).toBe("function");
  });

  test("exports browserHostBridge object", async () => {
    const mod = await import("../bootstrap.tsx");
    expect(typeof mod.browserHostBridge).toBe("object");
    expect(typeof mod.browserHostBridge.getCapabilities).toBe("function");
  });
});
