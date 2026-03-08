import { HiddenProjectList as UIHiddenProjectList } from "@cookielab.io/klovi-ui-components/sessions";
import { useKloviClient } from "../../../lib/context.ts";
import type { Project } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";

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
  const client = useKloviClient();
  const { data, loading, error, retry } = useRPC<{ projects: Project[] }>(
    () => client.getProjects(),
    [client],
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
