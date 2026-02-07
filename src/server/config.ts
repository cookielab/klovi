import { homedir } from "node:os";
import { join } from "node:path";

let projectsDir = join(homedir(), ".claude", "projects");

export function getProjectsDir(): string {
  return projectsDir;
}

export function setProjectsDir(dir: string): void {
  projectsDir = dir;
}
