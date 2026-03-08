import { describe, expect, test } from "bun:test";
import { makePackageHttpApp } from "./http-app.ts";

describe("makePackageHttpApp", () => {
  test("is a function", () => {
    expect(typeof makePackageHttpApp).toBe("function");
  });
});
