import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { extractFirstHeading, loadCursorPlanSession, parsePlanFrontmatter, readPlanDisplayName } from "./plans";


const N_1706000000000 = 1_706_000_000_000;

const testDir = join(tmpdir(), `klovi-cursor-plans-test-${Date.now()}`);

function runEffect<A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>) {
	return Effect.runPromise(effect.pipe(Effect.provide(NodeFileSystem.layer)));
}

describe("cursor plans", () => {
	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("parsePlanFrontmatter strips YAML frontmatter and extracts name", () => {
		const parsed = parsePlanFrontmatter("---\nname: Auth rollout\nowner: platform\n---\n\n# Heading\n\nBody text");

		expect(parsed.name).toBe("Auth rollout");
		expect(parsed.body).toBe("# Heading\n\nBody text");
	});

	it("readPlanDisplayName falls back from frontmatter name to heading to file stem", async () => {
		const headingPlanPath = join(testDir, "heading-only.plan.md");
		const stemPlanPath = join(testDir, "fallback-name.plan.md");

		await writeFile(headingPlanPath, "# Heading only\n\nPlan body");
		await writeFile(stemPlanPath, "Plain text body");

		expect(await runEffect(readPlanDisplayName(headingPlanPath))).toBe("Heading only");
		expect(await runEffect(readPlanDisplayName(stemPlanPath))).toBe("fallback-name");
		expect(extractFirstHeading("# Direct heading\n\nBody")).toBe("Direct heading");
	});

	it("loadCursorPlanSession returns a single system turn without frontmatter", async () => {
		const planPath = join(testDir, "auth-rollout.plan.md");
		await writeFile(planPath, "---\nname: Auth rollout\n---\n\n# Tasks\n\n- Build it");

		const session = await runEffect(
			loadCursorPlanSession({
				kind: "plan",
				rawSessionId: "plan:plan-1",
				projectPath: "/tmp/project",
				planId: "plan-1",
				filePath: planPath,
				createdAtMs: N_1706000000000,
				lastUpdatedAtMs: N_1706000000000,
				createdBy: "composer-1",
				timestamp: "2024-01-11T19:06:40.000Z",
				firstMessage: "Auth rollout",
				slug: "plan-1",
				model: "unknown",
				gitBranch: "",
				sessionType: "plan",
			}),
		);

		expect(session.turns).toHaveLength(1);
		expect(session.turns[0]?.kind).toBe("system");
		expect(session.turns[0]?.text).toBe("# Tasks\n\n- Build it");
	});
});
