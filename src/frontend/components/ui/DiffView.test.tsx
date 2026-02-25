import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { DiffView, formatDiff } from "./DiffView.tsx";

afterEach(cleanup);

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
    const { getByText } = render(
      <DiffView filePath="/src/app.ts" oldString="old" newString="new" />,
    );
    expect(getByText("/src/app.ts")).toBeTruthy();
  });

  test("renders diff content", () => {
    const { container } = render(
      <DiffView filePath="/a.ts" oldString="const x = 1;" newString="const x = 2;" />,
    );
    expect(container.textContent).toContain("-const x = 1;");
    expect(container.textContent).toContain("+const x = 2;");
  });
});
