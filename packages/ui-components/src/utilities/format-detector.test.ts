import { detectOutputFormat } from "./format-detector";

describe("detectOutputFormat", () => {
	it("returns null for empty, whitespace, and plain text", () => {
		expect(detectOutputFormat("")).toBeNull();
		expect(detectOutputFormat("   \n  ")).toBeNull();
		expect(detectOutputFormat("hello world")).toBeNull();
	});

	describe("JSON", () => {
		it("detects JSON objects and arrays", () => {
			expect(detectOutputFormat('{"name":"test"}')).toBe("json");
			expect(detectOutputFormat("[1,2,3]")).toBe("json");
		});

		it("rejects invalid JSON braces", () => {
			expect(detectOutputFormat("{not valid json}")).toBeNull();
		});
	});

	describe("Diff", () => {
		it("detects unified diff headers", () => {
			const diff = "diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new";
			expect(detectOutputFormat(diff)).toBe("diff");
		});

		it("detects diff by line density threshold", () => {
			const diffish = "@@ -1,4 +1,4 @@\n-line1\n+line1 updated\n-line2\n+line2 updated";
			expect(detectOutputFormat(diffish)).toBe("diff");
		});
	});

	describe("XML/HTML", () => {
		it("detects xml/html wrappers", () => {
			expect(detectOutputFormat('<?xml version="1.0"?><root></root>')).toBe("markup");
			expect(detectOutputFormat("<!DOCTYPE html><html><body></body></html>")).toBe("markup");
			expect(detectOutputFormat("<div><span>ok</span></div>")).toBe("markup");
		});

		it("rejects non-closed html-like text", () => {
			expect(detectOutputFormat("<not actually html")).toBeNull();
		});
	});

	describe("TypeScript", () => {
		it("detects declarations", () => {
			expect(detectOutputFormat("interface User {\n  name: string;\n}")).toBe("typescript");
			expect(detectOutputFormat("export type Result = string | number;")).toBe("typescript");
		});

		it("detects type annotations in code structure", () => {
			const code = "const user: Record<string, string> = {};\nfunction run() {\n  return user;\n}";
			expect(detectOutputFormat(code)).toBe("typescript");
		});
	});

	describe("Python", () => {
		it("detects declarations and __name__ pattern", () => {
			expect(detectOutputFormat("def hello():\n    print('world')")).toBe("python");
			expect(detectOutputFormat("import os\nfrom pathlib import Path")).toBe("python");
			expect(detectOutputFormat('if __name__ == "__main__":\n    main()')).toBe("python");
		});

		it("detects block-heavy python snippets", () => {
			const snippet = "if ready:\n    for item in items:\n        pass";
			expect(detectOutputFormat(snippet)).toBe("python");
		});
	});

	describe("CSS", () => {
		it("detects selector declaration blocks and at-rules", () => {
			expect(detectOutputFormat(".container {\n  color: red;\n}")).toBe("css");
			expect(detectOutputFormat("@media (max-width: 600px) {\n  body { margin: 0; }\n}")).toBe("css");
		});
	});

	describe("YAML", () => {
		it("detects yaml frontmatter and key-value documents", () => {
			expect(detectOutputFormat("---\nname: app\nversion: 1")).toBe("yaml");
			expect(detectOutputFormat("name: app\nversion: 1\ndescription: test")).toBe("yaml");
		});

		it("rejects yaml-like data with braces", () => {
			expect(detectOutputFormat("name: test\ndata: { nested: true }")).toBeNull();
		});
	});

	it("prioritizes JSON over other heuristics", () => {
		expect(detectOutputFormat('{"import":"value"}')).toBe("json");
	});
});
