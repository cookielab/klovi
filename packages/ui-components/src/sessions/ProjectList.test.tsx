import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Project } from "../types/index";
import { ProjectList } from "./ProjectList";

const N_12 = 12;
const N_400 = 400;
const N_50 = 50;

function makeProject(overrides: Partial<Project> = {}): Project {
	return {
		encodedPath: "p1",
		name: "/Users/dev/klovi",
		fullPath: "/Users/dev/klovi",
		sessionCount: N_12,
		lastActivity: "2025-01-01T10:00:00Z",
		...overrides,
	};
}

afterEach(cleanup);

describe("ProjectList (package)", () => {
	it("renders visible projects and supports selection", () => {
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

	it("hide button calls onHide without selecting", () => {
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

	it("shows hidden-projects link when hidden IDs exist", () => {
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

	it("renders only a windowed slice for large filtered project lists", () => {
		const projects = Array.from({ length: N_400 }, (_, i) =>
			makeProject({ encodedPath: `p-${i}`, name: `/Users/dev/proj-${i}` }),
		);
		const { container } = render(
			<div>
				<ProjectList
					projects={projects}
					hiddenIds={new Set()}
					onSelect={mock()}
					onHide={mock()}
					onShowHidden={mock()}
				/>
			</div>,
		);
		const items = container.querySelectorAll("[data-project-encoded-path]");
		expect(items.length).toBeLessThan(N_50);
		expect(items.length).toBeGreaterThan(0);
	});
});
