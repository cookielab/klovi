import { describe, expect, test } from "bun:test";
import { epochMsToIso, epochSecondsToIso, maxIso, sortByIsoDesc } from "./iso-time.ts";

describe("iso-time helpers", () => {
  test("maxIso returns empty string for empty input", () => {
    expect(maxIso([])).toBe("");
  });

  test("maxIso returns latest ISO timestamp", () => {
    const latest = maxIso([
      "2025-01-01T00:00:00.000Z",
      "2025-03-15T10:20:30.000Z",
      "2024-12-31T23:59:59.000Z",
    ]);
    expect(latest).toBe("2025-03-15T10:20:30.000Z");
  });

  test("sortByIsoDesc sorts objects by selected ISO field", () => {
    const items = [
      { id: "a", timestamp: "2025-01-01T00:00:00.000Z" },
      { id: "b", timestamp: "2025-03-15T10:20:30.000Z" },
      { id: "c", timestamp: "2024-12-31T23:59:59.000Z" },
    ];

    sortByIsoDesc(items, (item) => item.timestamp);
    expect(items.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  test("epochMsToIso converts unix milliseconds to ISO", () => {
    expect(epochMsToIso(1735689600000)).toBe("2025-01-01T00:00:00.000Z");
  });

  test("epochSecondsToIso converts unix seconds to ISO", () => {
    expect(epochSecondsToIso(1735689600)).toBe("2025-01-01T00:00:00.000Z");
  });
});
