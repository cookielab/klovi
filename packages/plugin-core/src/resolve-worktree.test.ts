import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { resolveGitWorktree, resolveT3CodePaths, stripT3CodeSuffix } from "./resolve-worktree.ts";

const run = <A>(effect: Effect.Effect<A, never, FileSystem.FileSystem>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeFileSystem.layer)));

// biome-ignore lint/security/noSecrets: test function name, not a secret
describe("stripT3CodeSuffix", () => {
  test("returns null for normal paths", () => {
    expect(stripT3CodeSuffix("/Users/dev/project")).toBeNull();
  });

  test("returns null for path without t3code prefix", () => {
    expect(stripT3CodeSuffix("/Users/dev/not-t3code-abc123")).toBeNull();
  });

  test("returns null for t3code as directory (not suffix)", () => {
    expect(stripT3CodeSuffix("/Users/dev/t3code/something")).toBeNull();
  });

  test("returns null for t3code without hex chars", () => {
    expect(stripT3CodeSuffix("/Users/dev/project/t3code-xyz")).toBeNull();
  });

  test("strips t3code-<hex> suffix and returns parent path + project name", () => {
    const result = stripT3CodeSuffix("/Users/dev/.t3/worktrees/Deltro/t3code-0b699669");
    expect(result).toEqual({
      path: "/Users/dev/.t3/worktrees/Deltro",
      projectName: "Deltro",
    });
  });

  test("handles various hex lengths", () => {
    // biome-ignore lint/security/noSecrets: test path with hex suffix, not a secret
    const result = stripT3CodeSuffix("/home/user/worktrees/MyApp/t3code-abcdef0123456789");
    expect(result).toEqual({
      path: "/home/user/worktrees/MyApp",
      projectName: "MyApp",
    });
  });

  test("handles short hex", () => {
    const result = stripT3CodeSuffix("/worktrees/Foo/t3code-ab");
    expect(result).toEqual({
      path: "/worktrees/Foo",
      projectName: "Foo",
    });
  });

  test("handles single hex char", () => {
    const result = stripT3CodeSuffix("/worktrees/Bar/t3code-a");
    expect(result).toEqual({
      path: "/worktrees/Bar",
      projectName: "Bar",
    });
  });
});

describe("resolveGitWorktree", () => {
  const testDir = join(tmpdir(), `klovi-resolve-worktree-test-${Date.now()}`);

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("returns path unchanged when .git does not exist", async () => {
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe(testDir);
  });

  test("returns path unchanged when .git is a directory", async () => {
    await mkdir(join(testDir, ".git"));
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe(testDir);
  });

  test("resolves to main repo when .git file has valid gitdir", async () => {
    await writeFile(
      join(testDir, ".git"),
      "gitdir: /Users/dev/Workspace/Deltro/.git/worktrees/t3code-abc123\n",
    );
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe("/Users/dev/Workspace/Deltro");
  });

  test("handles trailing whitespace in .git file", async () => {
    await writeFile(
      join(testDir, ".git"),
      "gitdir: /home/user/repo/.git/worktrees/branch-name   \n\n",
    );
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe("/home/user/repo");
  });

  test("returns path unchanged for non-worktree gitdir", async () => {
    await writeFile(join(testDir, ".git"), "gitdir: /some/other/path\n");
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe(testDir);
  });

  test("returns path unchanged for malformed .git file", async () => {
    await writeFile(join(testDir, ".git"), "not a valid gitdir line");
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe(testDir);
  });

  test("returns path unchanged for empty .git file", async () => {
    await writeFile(join(testDir, ".git"), "");
    const result = await run(resolveGitWorktree(testDir));
    expect(result).toBe(testDir);
  });
});

describe("resolveT3CodePaths", () => {
  test("does nothing when no t3code paths are present", async () => {
    const projects = [
      { resolvedPath: "/Users/dev/project-a" },
      { resolvedPath: "/Users/dev/project-b" },
    ];
    await run(resolveT3CodePaths(projects));
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/project-a");
    expect(projects[1]?.resolvedPath).toBe("/Users/dev/project-b");
  });

  test("strips t3code suffix so worktrees merge together", async () => {
    const projects = [
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111" },
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-bbb222" },
    ];
    await run(resolveT3CodePaths(projects));
    expect(projects[0]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
    expect(projects[1]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
  });

  test("merges t3code paths with unique name match", async () => {
    const projects = [
      { resolvedPath: "/Users/dev/Workspace/Deltro" },
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111" },
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-bbb222" },
    ];
    await run(resolveT3CodePaths(projects));
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/Workspace/Deltro");
    expect(projects[1]?.resolvedPath).toBe("/Users/dev/Workspace/Deltro");
    expect(projects[2]?.resolvedPath).toBe("/Users/dev/Workspace/Deltro");
  });

  test("keeps stripped path when no name match exists", async () => {
    const projects = [
      { resolvedPath: "/Users/dev/other-project" },
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111" },
    ];
    await run(resolveT3CodePaths(projects));
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/other-project");
    expect(projects[1]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
  });

  test("does not match t3code projects against each other for name lookup", async () => {
    // Two t3code worktrees with same project name but no "real" project
    const projects = [
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-aaa111" },
      { resolvedPath: "/home/.t3/worktrees/Deltro/t3code-bbb222" },
    ];
    await run(resolveT3CodePaths(projects));
    // Both should merge together under the stripped path, not match against each other
    expect(projects[0]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
    expect(projects[1]?.resolvedPath).toBe("/home/.t3/worktrees/Deltro");
  });

  test("leaves non-t3code projects unchanged even with similar names", async () => {
    const projects = [
      { resolvedPath: "/Users/dev/Workspace/Deltro" },
      { resolvedPath: "/Users/dev/other/Deltro" },
    ];
    await run(resolveT3CodePaths(projects));
    expect(projects[0]?.resolvedPath).toBe("/Users/dev/Workspace/Deltro");
    expect(projects[1]?.resolvedPath).toBe("/Users/dev/other/Deltro");
  });
});
