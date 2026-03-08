import { Button } from "@cookielab.io/klovi-design-system";
import type { Project } from "../types/index.ts";
import { FetchError } from "../utilities/FetchError.tsx";
import styles from "./HiddenProjectList.module.css";
import { projectDisplayName } from "./ProjectList.tsx";

function s(name: string | undefined): string {
  return name ?? "";
}

export interface HiddenProjectListProps {
  projects: Project[];
  loading?: boolean | undefined;
  error?: string | undefined;
  onRetry?: (() => void) | undefined;
  hiddenIds: Set<string>;
  onUnhide: (encodedPath: string) => void;
  onBack: () => void;
}

export function HiddenProjectList({
  projects,
  loading,
  error,
  onRetry,
  hiddenIds,
  onUnhide,
  onBack,
}: HiddenProjectListProps) {
  if (loading) return <div className={s(styles["loading"])}>Loading...</div>;
  if (error) return <FetchError error={error} {...(onRetry ? { onRetry } : {})} />;

  const hidden = projects.filter((p) => hiddenIds.has(p.encodedPath));

  return (
    <div className={s(styles["hiddenProjectsPage"])}>
      <button type="button" className={s(styles["backBtn"])} onClick={onBack}>
        ← Back to projects
      </button>
      <h2 className={s(styles["heading"])}>Hidden Projects</h2>
      {hidden.length === 0 ? (
        <div className={s(styles["emptyState"])}>
          <div className={s(styles["emptyStateTitle"])}>No hidden projects</div>
          <p>Projects you hide will appear here</p>
        </div>
      ) : (
        hidden.map((project) => (
          <div key={project.encodedPath} className={s(styles["listItem"])}>
            <div className={s(styles["listItemContent"])}>
              <div className={s(styles["listItemTitle"])}>{projectDisplayName(project)}</div>
              <div className={s(styles["listItemMeta"])}>
                {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
              </div>
            </div>
            <Button size="sm" onClick={() => onUnhide(project.encodedPath)}>
              Unhide
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
