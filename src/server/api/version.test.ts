import { describe, expect, test } from "bun:test";
import { handleVersion } from "./version.ts";

describe("handleVersion", () => {
  test("returns JSON response", () => {
    const response = handleVersion();
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("response body contains version", async () => {
    const response = handleVersion();
    const body = await response.json();
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe("string");
  });

  test("response body contains commitHash", async () => {
    const response = handleVersion();
    const body = await response.json();
    expect("commitHash" in body).toBe(true);
  });
});
