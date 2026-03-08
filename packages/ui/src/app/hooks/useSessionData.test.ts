import { describe, expect, test } from "bun:test";
import { useSessionData, useSubAgentSessionData } from "./useSessionData.ts";

describe("useSessionData", () => {
  test("useSessionData is exported", () => {
    expect(typeof useSessionData).toBe("function");
  });

  test("useSubAgentSessionData is exported", () => {
    expect(typeof useSubAgentSessionData).toBe("function");
  });
});
