import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project } from "../types/index.ts";
import { ProjectList } from "./ProjectList.tsx";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    encodedPath: "p1",
    name: "/Users/dev/klovi",
    fullPath: "/Users/dev/klovi",
    sessionCount: 12,
    lastActivity: "2025-01-01T10:00:00Z",
    ...overrides,
  };
}

afterEach(cleanup);

describe("ProjectList (package)", () => {
  test("renders visible projects and supports selection", () => {
    const onSelect = mock();
    const projects = [makeProject({ encodedPath: "p1", name: "/Users/dev/alpha" })];

    const { getByText } = render(
      <ProjectList
        projects={projects}
        hiddenIds={new Set()}
        onSelect={onSelect}
        onHide={mock()}
        onShowHidden={mock()}
      />,
    );

    fireEvent.click(getByText("dev/alpha"));

    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  test("hide button calls onHide without selecting", () => {
    const onSelect = mock();
    const onHide = mock();
    const project = makeProject({ encodedPath: "p2" });

    const { getByTitle } = render(
      <ProjectList
        projects={[project]}
        hiddenIds={new Set()}
        onSelect={onSelect}
        onHide={onHide}
        onShowHidden={mock()}
      />,
    );

    fireEvent.click(getByTitle("Hide project"));

    expect(onHide).toHaveBeenCalledWith("p2");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("shows hidden-projects link when hidden IDs exist", () => {
    const { getByText } = render(
      <ProjectList
        projects={[makeProject()]}
        hiddenIds={new Set(["hidden-1", "hidden-2"])}
        onSelect={mock()}
        onHide={mock()}
        onShowHidden={mock()}
      />,
    );

    expect(getByText("2 hidden projects")).toBeTruthy();
  });
});
