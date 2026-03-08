import { describe, expect, test } from "bun:test";
import { epochMsToIso, epochSecondsToIso, maxIso, sortByIsoDesc } from "./iso-time.ts";

describe("iso-time helpers", () => {
  test("maxIso handles empty and mixed timestamps", () => {
    expect(maxIso([])).toBe("");
    expect(maxIso(["2025-01-01T00:00:00Z", "2026-03-01T00:00:00Z", "2025-12-31T23:59:59Z"])).toBe(
      "2026-03-01T00:00:00Z",
    );
  });

  // biome-ignore lint/security/noSecrets: descriptive test name, no secret material
  test("sortByIsoDesc sorts items in-place by latest first", () => {
    const items = [
      { id: "old", ts: "2025-01-01T00:00:00Z" },
      { id: "new", ts: "2026-01-01T00:00:00Z" },
      { id: "mid", ts: "2025-06-01T00:00:00Z" },
    ];

    sortByIsoDesc(items, (item) => item.ts);

    expect(items.map((item) => item.id)).toEqual(["new", "mid", "old"]);
  });

  test("epoch converters return ISO timestamps", () => {
    expect(epochMsToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(epochSecondsToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(epochSecondsToIso(1)).toBe("1970-01-01T00:00:01.000Z");
  });
});
