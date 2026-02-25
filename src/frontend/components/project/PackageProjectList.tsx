import { ProjectList as UIProjectList } from "@cookielab.io/klovi-ui/sessions";
import { useState } from "react";
import type { Project } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";

interface PackageProjectListProps {
  onSelect: (project: Project) => void;
  selected?: string;
  hiddenIds: Set<string>;
  onHide: (encodedPath: string) => void;
  onShowHidden: () => void;
}

export function PackageProjectList({
  onSelect,
  selected,
  hiddenIds,
  onHide,
  onShowHidden,
}: PackageProjectListProps) {
  const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(
    () => getRPC().request.getProjects({}),
    [],
  );
  const [filter, setFilter] = useState("");
  const projects = data?.projects ?? [];

  return (
    <UIProjectList
      projects={projects}
      loading={loading}
      error={error ?? undefined}
      onRetry={retry}
      selectedId={selected}
      hiddenIds={hiddenIds}
      onSelect={(encodedPath) => {
        const project = projects.find((entry) => entry.encodedPath === encodedPath);
        if (project) {
          onSelect(project);
        }
      }}
      onHide={onHide}
      onShowHidden={onShowHidden}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
