import { describe, expect, test } from "bun:test";
import { detectOutputFormat } from "./format-detector.ts";

describe("detectOutputFormat", () => {
  test("returns null for empty string", () => {
    expect(detectOutputFormat("")).toBeNull();
  });

  test("returns null for whitespace only", () => {
    expect(detectOutputFormat("   \n  ")).toBeNull();
  });

  test("returns null for plain text", () => {
    expect(detectOutputFormat("hello world")).toBeNull();
  });

  test("returns null for file listing", () => {
    expect(detectOutputFormat("file1.txt\nfile2.txt\nfile3.txt")).toBeNull();
  });

  // JSON
  describe("JSON", () => {
    test("detects JSON object", () => {
      expect(detectOutputFormat('{"name": "test", "version": "1.0.0"}')).toBe("json");
    });

    test("detects JSON array", () => {
      expect(detectOutputFormat("[1, 2, 3]")).toBe("json");
    });

    test("detects multiline JSON", () => {
      const json = `{
  "name": "test",
  "dependencies": {
    "react": "^19.0.0"
  }
}`;
      expect(detectOutputFormat(json)).toBe("json");
    });

    test("rejects invalid JSON with braces", () => {
      expect(detectOutputFormat("{not valid json}")).toBeNull();
    });

    test("detects empty JSON object", () => {
      expect(detectOutputFormat("{}")).toBe("json");
    });

    test("detects empty JSON array", () => {
      expect(detectOutputFormat("[]")).toBe("json");
    });
  });

  // Diff
  describe("Diff", () => {
    test("detects unified diff starting with 'diff '", () => {
      const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 3;`;
      expect(detectOutputFormat(diff)).toBe("diff");
    });

    test("detects diff starting with '--- '", () => {
      const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
      expect(detectOutputFormat(diff)).toBe("diff");
    });

    test("detects diff with multiple +/- lines", () => {
      const diff = `@@ -1,4 +1,4 @@
-line1
-line2
+line1changed
+line2changed
 unchanged`;
      expect(detectOutputFormat(diff)).toBe("diff");
    });
  });

  // XML/HTML
  describe("XML/HTML", () => {
    test("detects XML declaration", () => {
      expect(detectOutputFormat('<?xml version="1.0"?>\n<root></root>')).toBe("markup");
    });

    test("detects HTML DOCTYPE", () => {
      expect(detectOutputFormat("<!DOCTYPE html>\n<html><body></body></html>")).toBe("markup");
    });

    test("detects HTML tag structure", () => {
      expect(detectOutputFormat("<div><p>Hello</p></div>")).toBe("markup");
    });

    test("rejects plain text starting with <", () => {
      // No closing tag at end
      expect(detectOutputFormat("<not actually html")).toBeNull();
    });
  });

  // TypeScript
  describe("TypeScript", () => {
    test("detects interface declaration", () => {
      expect(detectOutputFormat("interface User {\n  name: string;\n}")).toBe("typescript");
    });

    test("detects exported interface", () => {
      expect(detectOutputFormat("export interface Config {\n  port: number;\n}")).toBe(
        "typescript",
      );
    });

    test("detects type alias", () => {
      expect(detectOutputFormat("type Status = 'active' | 'inactive';")).toBe("typescript");
    });

    test("detects exported type", () => {
      expect(detectOutputFormat("export type Result<T> = Success<T> | Error;")).toBe("typescript");
    });
  });

  // Python
  describe("Python", () => {
    test("detects function definition", () => {
      expect(detectOutputFormat("def hello():\n    print('world')")).toBe("python");
    });

    test("detects class definition", () => {
      expect(detectOutputFormat("class MyClass:\n    def __init__(self):\n        pass")).toBe(
        "python",
      );
    });

    test("detects import statement", () => {
      expect(detectOutputFormat("import os\nimport sys")).toBe("python");
    });

    test("detects if __name__ pattern", () => {
      expect(detectOutputFormat('if __name__ == "__main__":\n    main()')).toBe("python");
    });
  });

  // CSS
  describe("CSS", () => {
    test("detects class selector with declarations", () => {
      expect(detectOutputFormat(".container {\n  color: red;\n}")).toBe("css");
    });

    test("detects @media rule", () => {
      expect(detectOutputFormat("@media (max-width: 768px) {\n  body { padding: 0; }\n}")).toBe(
        "css",
      );
    });

    test("detects element selector with declarations", () => {
      expect(detectOutputFormat("body {\n  margin: 0;\n  padding: 0;\n}")).toBe("css");
    });

    test("detects @import rule", () => {
      expect(detectOutputFormat('@import url("styles.css");\n\nbody { margin: 0; }')).toBe("css");
    });
  });

  // YAML
  describe("YAML", () => {
    test("detects YAML starting with ---", () => {
      expect(detectOutputFormat("---\nname: test\nversion: 1.0")).toBe("yaml");
    });

    test("detects key-value YAML", () => {
      expect(detectOutputFormat("name: my-app\nversion: 1.0.0\ndescription: A test app")).toBe(
        "yaml",
      );
    });

    test("rejects YAML-like text with braces (could be JSON)", () => {
      expect(detectOutputFormat("name: test\ndata: { nested: true }")).toBeNull();
    });
  });

  // Priority / ambiguity
  describe("detection priority", () => {
    test("JSON takes priority over other formats", () => {
      // Valid JSON that could look like other formats
      expect(detectOutputFormat('{"import": "value"}')).toBe("json");
    });
  });
});
