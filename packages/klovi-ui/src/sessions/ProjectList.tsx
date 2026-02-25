import { Button } from "@cookielab.io/klovi-design-system";
import type { Project } from "../types/index.ts";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters.ts";
import styles from "./ProjectList.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

const PATH_SEPARATOR_REGEX = /[/\\]/;

export function projectDisplayName(project: Project): string {
  const parts = project.name.split(PATH_SEPARATOR_REGEX).filter(Boolean);
  return parts.slice(-2).join("/");
}

export interface ProjectListProps {
  projects: Project[];
  loading?: boolean | undefined;
  error?: string | undefined;
  onRetry?: (() => void) | undefined;
  selectedId?: string | undefined;
  hiddenIds: Set<string>;
  onSelect: (encodedPath: string) => void;
  onHide: (encodedPath: string) => void;
  onShowHidden: () => void;
  filter?: string | undefined;
  onFilterChange?: ((filter: string) => void) | undefined;
}

export function ProjectList({
  projects,
  loading,
  error,
  onRetry,
  selectedId,
  hiddenIds,
  onSelect,
  onHide,
  onShowHidden,
  filter = "",
  onFilterChange,
}: ProjectListProps) {
  if (loading) return <div className={s(styles["loading"])}>Loading projects...</div>;
  if (error) {
    return (
      <div className={s(styles["fetchError"])}>
        <span className={s(styles["fetchErrorMessage"])}>{error}</span>
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const filtered = projects.filter(
    (p) =>
      !hiddenIds.has(p.encodedPath) &&
      (p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.encodedPath.toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div>
      <input
        className={s(styles["filterInput"])}
        placeholder="Filter projects..."
        value={filter}
        onChange={(e) => onFilterChange?.(e.target.value)}
      />
      <div className={s(styles["sectionTitle"])}>Projects ({filtered.length})</div>
      {filtered.map((project) => (
        // biome-ignore lint/a11y/useSemanticElements: contains nested button, cannot be a <button>
        <div
          key={project.encodedPath}
          className={`${s(styles["listItem"])} ${selectedId === project.encodedPath ? s(styles["listItemActive"]) : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(project.encodedPath)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(project.encodedPath);
            }
          }}
        >
          <div className={s(styles["listItemContent"])}>
            <div className={s(styles["listItemTitle"])}>{projectDisplayName(project)}</div>
            <div className={s(styles["listItemMeta"])}>
              {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""} ·{" "}
              <time
                dateTime={project.lastActivity}
                title={formatFullDateTime(project.lastActivity)}
              >
                {formatRelativeTime(project.lastActivity)}
              </time>
            </div>
          </div>
          <button
            type="button"
            className={s(styles["btnHide"])}
            title="Hide project"
            onClick={(e) => {
              e.stopPropagation();
              onHide(project.encodedPath);
            }}
          >
            ×
          </button>
        </div>
      ))}
      {filtered.length === 0 && <div className={s(styles["emptyMessage"])}>No projects found</div>}
      {hiddenIds.size > 0 && (
        <button type="button" className={s(styles["hiddenProjectsLink"])} onClick={onShowHidden}>
          {hiddenIds.size} hidden project{hiddenIds.size !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
