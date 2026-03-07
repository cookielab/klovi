import { HiddenProjectList as UIHiddenProjectList } from "@cookielab.io/klovi-ui/sessions";
import type { Project } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";

interface PackageHiddenProjectListProps {
  hiddenIds: Set<string>;
  onUnhide: (encodedPath: string) => void;
  onBack: () => void;
}

export function PackageHiddenProjectList({
  hiddenIds,
  onUnhide,
  onBack,
}: PackageHiddenProjectListProps) {
  const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(
    () => getRPC().request.getProjects({}),
    [],
  );

  return (
    <UIHiddenProjectList
      projects={data?.projects ?? []}
      loading={loading}
      error={error ?? undefined}
      onRetry={retry}
      hiddenIds={hiddenIds}
      onUnhide={onUnhide}
      onBack={onBack}
    />
  );
}
