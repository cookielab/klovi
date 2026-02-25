import { describe, expect, test } from "bun:test";
import { detectOutputFormat } from "./format-detector.ts";

describe("detectOutputFormat", () => {
  test("returns null for empty, whitespace, and plain text", () => {
    expect(detectOutputFormat("")).toBeNull();
    expect(detectOutputFormat("   \n  ")).toBeNull();
    expect(detectOutputFormat("hello world")).toBeNull();
  });

  describe("JSON", () => {
    test("detects JSON objects and arrays", () => {
      expect(detectOutputFormat('{"name":"test"}')).toBe("json");
      expect(detectOutputFormat("[1,2,3]")).toBe("json");
    });

    test("rejects invalid JSON braces", () => {
      expect(detectOutputFormat("{not valid json}")).toBeNull();
    });
  });

  describe("Diff", () => {
    test("detects unified diff headers", () => {
      const diff = `diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new`;
      expect(detectOutputFormat(diff)).toBe("diff");
    });

    test("detects diff by line density threshold", () => {
      const diffish = `@@ -1,4 +1,4 @@\n-line1\n+line1 updated\n-line2\n+line2 updated`;
      expect(detectOutputFormat(diffish)).toBe("diff");
    });
  });

  describe("XML/HTML", () => {
    test("detects xml/html wrappers", () => {
      expect(detectOutputFormat('<?xml version="1.0"?><root></root>')).toBe("markup");
      expect(detectOutputFormat("<!DOCTYPE html><html><body></body></html>")).toBe("markup");
      expect(detectOutputFormat("<div><span>ok</span></div>")).toBe("markup");
    });

    test("rejects non-closed html-like text", () => {
      expect(detectOutputFormat("<not actually html")).toBeNull();
    });
  });

  describe("TypeScript", () => {
    test("detects declarations", () => {
      expect(detectOutputFormat("interface User {\n  name: string;\n}")).toBe("typescript");
      expect(detectOutputFormat("export type Result = string | number;")).toBe("typescript");
    });

    test("detects type annotations in code structure", () => {
      const code = `const user: Record<string, string> = {};\nfunction run() {\n  return user;\n}`;
      expect(detectOutputFormat(code)).toBe("typescript");
    });
  });

  describe("Python", () => {
    test("detects declarations and __name__ pattern", () => {
      // biome-ignore lint/security/noSecrets: test data only
      expect(detectOutputFormat("def hello():\n    print('world')")).toBe("python");
      expect(detectOutputFormat("import os\nfrom pathlib import Path")).toBe("python");
      expect(detectOutputFormat('if __name__ == "__main__":\n    main()')).toBe("python");
    });

    test("detects block-heavy python snippets", () => {
      const snippet = `if ready:\n    for item in items:\n        pass`;
      expect(detectOutputFormat(snippet)).toBe("python");
    });
  });

  describe("CSS", () => {
    test("detects selector declaration blocks and at-rules", () => {
      expect(detectOutputFormat(".container {\n  color: red;\n}")).toBe("css");
      expect(detectOutputFormat("@media (max-width: 600px) {\n  body { margin: 0; }\n}")).toBe(
        "css",
      );
    });
  });

  describe("YAML", () => {
    test("detects yaml frontmatter and key-value documents", () => {
      expect(detectOutputFormat("---\nname: app\nversion: 1")).toBe("yaml");
      expect(detectOutputFormat("name: app\nversion: 1\ndescription: test")).toBe("yaml");
    });

    test("rejects yaml-like data with braces", () => {
      expect(detectOutputFormat("name: test\ndata: { nested: true }")).toBeNull();
    });
  });

  test("prioritizes JSON over other heuristics", () => {
    expect(detectOutputFormat('{"import":"value"}')).toBe("json");
  });
});
