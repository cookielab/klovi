import { describe, expect, test } from "bun:test";

import { makeStaticHandler } from "./static-handler.ts";

describe("makeStaticHandler", () => {
  test("is a function", () => {
    expect(typeof makeStaticHandler).toBe("function");
  });
});
