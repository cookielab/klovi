import { join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

const T3CODE_SUFFIX_REGEX = /\/t3code-[a-f0-9]+$/u;
const GITDIR_WORKTREE_REGEX = /^gitdir:\s*(.+?)\s*$/u;
const GIT_WORKTREES_SEGMENT = "/.git/worktrees/";

/**
 * If `path` ends with `/t3code-<hex>`, strips that segment and returns the
 * parent path plus the project name (last segment of the parent).
 * Returns `null` if the path does not match the t3code worktree pattern.
 */
export function stripT3CodeSuffix(path: string): { path: string; projectName: string } | null {
	if (!T3CODE_SUFFIX_REGEX.test(path)) {
		return null;
	}
	const parentPath = path.replace(T3CODE_SUFFIX_REGEX, "");
	const lastSlash = parentPath.lastIndexOf("/");
	const projectName = lastSlash === -1 ? parentPath : parentPath.slice(lastSlash + 1);
	return { path: parentPath, projectName: projectName };
}

/**
 * Reads `<worktreePath>/.git` as a file and parses the `gitdir:` line to find
 * the main repository path. Git worktrees store a `.git` **file** (not directory)
 * containing `gitdir: <main-repo>/.git/worktrees/<name>`.
 *
 * Returns the main repository path if successfully resolved, otherwise falls
 * back to the original `worktreePath`.
 */
export function resolveGitWorktree(worktreePath: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const dotGitPath = join(worktreePath, ".git");

		const info = yield* fs.stat(dotGitPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
		if (!info || info.type !== "File") {
			return worktreePath;
		}

		const content = yield* fs.readFileString(dotGitPath).pipe(Effect.catchAll(() => Effect.succeed("")));
		if (!content) {
			return worktreePath;
		}

		const match = GITDIR_WORKTREE_REGEX.exec(content);
		if (!match?.[1]) {
			return worktreePath;
		}

		const gitdir = match[1];
		const worktreeIdx = gitdir.indexOf(GIT_WORKTREES_SEGMENT);
		if (worktreeIdx === -1) {
			return worktreePath;
		}

		return gitdir.slice(0, worktreeIdx);
	});
}

function lastSegment(path: string): string {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash === -1 ? path : path.slice(lastSlash + 1);
}

type T3CodeEntry<T> = {
	project: T;
	originalPath: string;
	projectName: string;
};

/** Phase 1: identify and strip t3code suffixes, mutating resolvedPath in-place. */
function collectT3CodeEntries<T extends { resolvedPath: string }>(projects: T[]): T3CodeEntry<T>[] {
	const entries: T3CodeEntry<T>[] = [];
	for (const project of projects) {
		const stripped = stripT3CodeSuffix(project.resolvedPath);
		if (stripped) {
			entries.push({
				project: project,
				originalPath: project.resolvedPath,
				projectName: stripped.projectName,
			});
			project.resolvedPath = stripped.path;
		}
	}
	return entries;
}

/** Build map: last path segment → unique resolvedPaths from non-t3code projects. */
function buildNameMap<T extends { resolvedPath: string }>(
	projects: T[],
	t3codeProjects: Set<T>,
): Map<string, string[]> {
	const nameToResolvedPaths = new Map<string, string[]>();
	for (const project of projects) {
		if (t3codeProjects.has(project)) {
			continue;
		}
		const name = lastSegment(project.resolvedPath);
		if (!name) {
			continue;
		}
		const existing = nameToResolvedPaths.get(name);
		if (existing) {
			if (!existing.includes(project.resolvedPath)) {
				existing.push(project.resolvedPath);
			}
		} else {
			nameToResolvedPaths.set(name, [project.resolvedPath]);
		}
	}
	return nameToResolvedPaths;
}

/** Resolve a single t3code entry against the name map, using .git fallback if ambiguous. */
function resolveEntry<T extends { resolvedPath: string }>(entry: T3CodeEntry<T>, nameMap: Map<string, string[]>) {
	return Effect.gen(function* () {
		const candidates = nameMap.get(entry.projectName);
		if (!candidates || candidates.length === 0) {
			return;
		}

		if (candidates.length === 1) {
			const resolvedPath = candidates[0];
			if (resolvedPath) {
				entry.project.resolvedPath = resolvedPath;
			}
			return;
		}

		// Ambiguous — fall back to .git file
		const resolved = yield* resolveGitWorktree(entry.originalPath);
		if (candidates.includes(resolved)) {
			entry.project.resolvedPath = resolved;
		}
	});
}

/**
 * Resolves t3code worktree paths to their main repository paths in-place.
 *
 * Phase 1: Strip `/t3code-<hex>` suffix so worktrees for the same project merge.
 * Phase 2: Name-match the project name against non-t3code projects — if exactly
 *          one match, use its `resolvedPath`.
 * Phase 3: If multiple name matches, fall back to reading the `.git` file.
 */
export function resolveT3CodePaths<T extends { resolvedPath: string }>(projects: T[]) {
	return Effect.gen(function* () {
		const t3codeEntries = collectT3CodeEntries(projects);
		if (t3codeEntries.length === 0) {
			return;
		}

		const t3codeProjects = new Set(t3codeEntries.map((e) => e.project));
		const nameMap = buildNameMap(projects, t3codeProjects);

		for (const entry of t3codeEntries) {
			yield* resolveEntry(entry, nameMap);
		}
	});
}
