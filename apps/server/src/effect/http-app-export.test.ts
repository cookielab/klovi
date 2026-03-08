import { describe, expect, test } from "bun:test";

describe("http-app exports", () => {
  test("makeRpcRouter is exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeRpcRouter).toBe("function");
  });

  test("makeHttpApp is still exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeHttpApp).toBe("function");
  });

  test("makeServeLayer is still exported", async () => {
    const mod = await import("./http-app.ts");
    expect(typeof mod.makeServeLayer).toBe("function");
  });
});
