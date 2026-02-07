const packageJsonPath = new URL("../../package.json", import.meta.url).pathname;
const packageJson = await Bun.file(packageJsonPath).json();
const version: string = packageJson.version;

let commitHash: string | null = null;
try {
  const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode === 0) {
    commitHash = output.trim();
  }
} catch {
  // git not available
}

export const appVersion = { version, commitHash };
