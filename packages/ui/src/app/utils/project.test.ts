import type { Project } from "../../shared/types";
import { projectDisplayName } from "./project";

function makeProject(name: string): Project {
	return {
		encodedPath: encodeURIComponent(name),
		name: name,
		fullPath: `/home/user/.claude/projects/${name}`,
		sessionCount: 1,
		lastActivity: "2025-01-01T00:00:00Z",
	};
}

describe("projectDisplayName", () => {
	it("returns last 2 segments of forward-slash path", () => {
		expect(projectDisplayName(makeProject("Users/alice/my-project"))).toBe("alice/my-project");
	});

	it("returns last 2 segments of backslash path", () => {
		expect(projectDisplayName(makeProject("Users\\alice\\my-project"))).toBe("alice/my-project");
	});

	it("handles mixed slashes", () => {
		expect(projectDisplayName(makeProject("Users/alice\\my-project"))).toBe("alice/my-project");
	});

	it("handles trailing slashes", () => {
		expect(projectDisplayName(makeProject("Users/alice/my-project/"))).toBe("alice/my-project");
	});

	it("returns full name for short paths", () => {
		expect(projectDisplayName(makeProject("my-project"))).toBe("my-project");
	});

	it("returns both segments for two-segment path", () => {
		expect(projectDisplayName(makeProject("alice/my-project"))).toBe("alice/my-project");
	});
});
