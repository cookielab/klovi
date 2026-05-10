import { join, resolve } from "node:path";

// --- constants ---

const PLUGIN_CORE_SRC = import.meta.dir;
const PACKAGES_DIR = resolve(PLUGIN_CORE_SRC, "..", "..");

const PLUGIN_SRC_DIRS: string[] = [
	join(PACKAGES_DIR, "plugin-core", "src"),
	join(PACKAGES_DIR, "plugin-claude-code", "src"),
	join(PACKAGES_DIR, "plugin-codex", "src"),
	join(PACKAGES_DIR, "plugin-cursor", "src"),
	join(PACKAGES_DIR, "plugin-opencode", "src"),
];

const FORBIDDEN_UI_EXTENSIONS: string[] = [".tsx", ".jsx", ".css", ".scss", ".sass", ".less"];

// This test file lives in plugin-core/src; exclude it from the React-import scan
// so its own regex patterns do not trigger a false positive.
const THIS_FILE = import.meta.filename;

// --- regexes at module level (useTopLevelRegex) ---

// Matches static import of the react package (not in JSDoc)
const REACT_STATIC_IMPORT_RE = /^import\s[^;]+from\s["']react["']/mu;

// Matches static import of the react jsx-runtime
const REACT_JSX_RUNTIME_IMPORT_RE = /^import\s[^;]+from\s["']react\/jsx-runtime["']/mu;

// Heuristic: JSX closing tags like </Component> (TypeScript never produces `</A` in source).
const JSX_CLOSE_TAG_RE = /<\/[A-Z]/u;

// Heuristic: JSX self-closing tags like <Component /> (space + /> is unambiguous JSX).
const JSX_SELF_CLOSE_RE = /<[A-Z][a-zA-Z]*\s*\/>/u;

// The commonjs form - these needles are stored as variables to prevent this file's
// own source text from triggering the guardrail during scanning.
const SQ = "'";
const DQ = '"';
const REACT_REQUIRE_NEEDLE_SQ = `require(${SQ}react${SQ})`;
const REACT_REQUIRE_NEEDLE_DQ = `require(${DQ}react${DQ})`;

// --- helpers ---

async function collectFilesWithExtensions(dir: string, extensions: string[]): Promise<string[]> {
	const glob = new Bun.Glob("**/*");
	const found: string[] = [];
	for await (const rel of glob.scan({ cwd: dir, dot: false })) {
		for (const ext of extensions) {
			if (rel.endsWith(ext)) {
				found.push(join(dir, rel));
				break;
			}
		}
	}
	return found;
}

async function collectTsFiles(dir: string): Promise<string[]> {
	const glob = new Bun.Glob("**/*.ts");
	const found: string[] = [];
	for await (const rel of glob.scan({ cwd: dir, dot: false })) {
		found.push(join(dir, rel));
	}
	return found;
}

type ReactViolation = {
	file: string;
	reason: string;
};

// biome-ignore lint/nursery/noMisleadingReturnType: biome false positive — the function correctly returns ReactViolation|null
async function detectReactImports(filePath: string): Promise<ReactViolation | null> {
	const content = await Bun.file(filePath).text();
	if (REACT_STATIC_IMPORT_RE.test(content)) {
		return { file: filePath, reason: "imports react" };
	}
	if (REACT_JSX_RUNTIME_IMPORT_RE.test(content)) {
		return { file: filePath, reason: "imports react/jsx-runtime" };
	}
	if (content.includes(REACT_REQUIRE_NEEDLE_SQ) || content.includes(REACT_REQUIRE_NEEDLE_DQ)) {
		return { file: filePath, reason: "require(react)" };
	}
	if (JSX_CLOSE_TAG_RE.test(content)) {
		return { file: filePath, reason: "contains JSX closing tag" };
	}
	if (JSX_SELF_CLOSE_RE.test(content)) {
		return { file: filePath, reason: "contains JSX self-closing tag" };
	}
	return null;
}

async function collectExtensionViolations(dirs: string[]): Promise<string[]> {
	const perDir = await Promise.all(dirs.map((dir) => collectFilesWithExtensions(dir, FORBIDDEN_UI_EXTENSIONS)));
	return perDir.flat();
}

async function collectReactViolations(dirs: string[]): Promise<ReactViolation[]> {
	const perDir = await Promise.all(
		dirs.map(async (dir) => {
			const files = await collectTsFiles(dir);
			const results = await Promise.all(files.filter((f) => f !== THIS_FILE).map((f) => detectReactImports(f)));
			return results.filter((v): v is ReactViolation => v !== null);
		}),
	);
	return perDir.flat();
}

// --- tests ---

describe("plugin boundary: no UI files", () => {
	it("plugin src trees contain no UI file extensions", async () => {
		const offenders = await collectExtensionViolations(PLUGIN_SRC_DIRS);
		expect(offenders).toEqual([]);
	});
});

describe("plugin boundary: no React imports", () => {
	it("plugin source .ts files do not import react or include JSX", async () => {
		const violations = await collectReactViolations(PLUGIN_SRC_DIRS);
		expect(violations).toEqual([]);
	});
});
