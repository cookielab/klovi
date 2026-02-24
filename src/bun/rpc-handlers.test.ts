import { describe, expect, test } from "bun:test";
import { getVersion } from "./rpc-handlers.ts";

describe("rpc-handlers", () => {
  test("getVersion returns version info", () => {
    const result = getVersion();
    expect(result).toHaveProperty("version");
    expect(typeof result.version).toBe("string");
    expect(result).toHaveProperty("commit");
    expect(typeof result.commit).toBe("string");
  });
});
