import { test, expect, describe } from "bun:test";
import { cleanCommandMessage, parseCommandMessage } from "./command-message.ts";

describe("cleanCommandMessage", () => {
  test("with command tags → returns args text", () => {
    const input =
      "<command-message>commit</command-message><command-name>/commit</command-name><command-args>fix: resolve login bug</command-args>";
    expect(cleanCommandMessage(input)).toBe("fix: resolve login bug");
  });

  test("with plain text → returns unchanged", () => {
    expect(cleanCommandMessage("Hello world")).toBe("Hello world");
  });
});

describe("parseCommandMessage", () => {
  test("with full tags → returns { name, args }", () => {
    const input =
      "<command-message>feature-dev</command-message><command-name>/feature-dev</command-name><command-args>implement login</command-args>";
    const result = parseCommandMessage(input);
    expect(result).toEqual({ name: "/feature-dev", args: "implement login" });
  });

  test("with missing args → returns { name, args: '' }", () => {
    const input =
      "<command-message>help</command-message><command-name>/help</command-name>";
    const result = parseCommandMessage(input);
    expect(result).toEqual({ name: "/help", args: "" });
  });

  test("with plain text → returns null", () => {
    expect(parseCommandMessage("Just a regular message")).toBeNull();
  });
});
