import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { DiffView, formatDiff } from "./DiffView.tsx";

describe("formatDiff", () => {
  test("prefixes old lines with - and new lines with +", () => {
    const result = formatDiff("foo\nbar", "foo\nbaz");
    expect(result).toBe("-foo\n-bar\n+foo\n+baz");
  });

  test("handles single-line strings", () => {
    const result = formatDiff("old", "new");
    expect(result).toBe("-old\n+new");
  });

  test("handles empty old string (pure addition)", () => {
    const result = formatDiff("", "added");
    expect(result).toBe("+added");
  });

  test("handles empty new string (pure deletion)", () => {
    const result = formatDiff("removed", "");
    expect(result).toBe("-removed");
  });

  test("handles both empty strings", () => {
    const result = formatDiff("", "");
    expect(result).toBe("");
  });
});

describe("DiffView", () => {
  test("renders file path in header", () => {
    const { container } = render(
      <DiffView filePath="/src/app.ts" oldString="old" newString="new" />,
    );
    const header = container.querySelector(".diff-view-header");
    expect(header).not.toBeNull();
    expect(header?.textContent).toBe("/src/app.ts");
  });

  test("renders diff content", () => {
    const { container } = render(
      <DiffView filePath="/a.ts" oldString="const x = 1;" newString="const x = 2;" />,
    );
    const content = container.querySelector(".diff-view-content");
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain("-const x = 1;");
    expect(content?.textContent).toContain("+const x = 2;");
  });
});
