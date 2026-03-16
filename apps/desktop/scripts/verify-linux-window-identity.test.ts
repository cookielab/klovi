import { describe, expect, test } from "bun:test";
import { parseArgs, parsePidList, selectWindowCandidate } from "./verify-linux-window-identity.ts";

describe("parseArgs", () => {
  test("accepts a single bundle path", () => {
    expect(parseArgs(["bun", "verify-linux-window-identity.ts", "/tmp/Klovi"])).toEqual({
      bundlePath: "/tmp/Klovi",
    });
  });
});

describe("parsePidList", () => {
  test("parses ps output with mixed whitespace", () => {
    expect(parsePidList(" 123\n456 \n\n 789\n")).toEqual([123, 456, 789]);
  });
});

describe("selectWindowCandidate", () => {
  test("prefers a matching window owned by the launcher process family", () => {
    const result = selectWindowCandidate(
      [
        {
          id: "0x1",
          pid: 999,
          wmClass: '"Klovi", "Klovi"',
          name: "Klovi",
        },
        {
          id: "0x2",
          pid: 321,
          wmClass: '"Klovi", "Klovi"',
          name: "Klovi",
        },
      ],
      new Set([321]),
      new Set<string>(),
    );

    expect(result?.id).toBe("0x2");
  });

  test("falls back to a new matching window when the owner pid changed", () => {
    const result = selectWindowCandidate(
      [
        {
          id: "0x1",
          pid: 999,
          wmClass: '"Klovi", "Klovi"',
          name: "Klovi",
        },
      ],
      new Set([321]),
      new Set(["0x0"]),
    );

    expect(result?.id).toBe("0x1");
  });

  test("ignores stale or incorrectly branded windows", () => {
    const result = selectWindowCandidate(
      [
        {
          id: "0x1",
          pid: 321,
          // biome-ignore lint/security/noSecrets: test fixture uses the known upstream WM_CLASS string
          wmClass: '"ElectrobunKitchenSink", "ElectrobunKitchenSink"',
          name: "Klovi",
        },
        {
          id: "0x2",
          pid: 654,
          wmClass: '"Klovi", "Klovi"',
          name: "Browser",
        },
        {
          id: "0x3",
          pid: 777,
          wmClass: '"Klovi", "Klovi"',
          name: "Klovi",
        },
      ],
      new Set([321]),
      new Set(["0x3"]),
    );

    expect(result).toBeNull();
  });
});
