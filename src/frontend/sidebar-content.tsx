import type React from "react";
import type { Project, SessionSummary } from "../shared/types.ts";
import { ProjectList } from "./components/project/ProjectList.tsx";
import { SessionList } from "./components/project/SessionList.tsx";
import type { ViewState } from "./view-state.ts";

interface SidebarActions {
  selectProject: (p: Project) => void;
  selectSession: (s: SessionSummary) => void;
  goHome: () => void;
  goHidden: () => void;
  hide: (id: string) => void;
}

export function getSidebarContent(
  view: ViewState,
  hiddenIds: Set<string>,
  actions: SidebarActions,
): React.ReactNode {
  if (view.kind === "home" || view.kind === "hidden") {
    return (
      <ProjectList
        onSelect={actions.selectProject}
        hiddenIds={hiddenIds}
        onHide={actions.hide}
        onShowHidden={actions.goHidden}
      />
    );
  }

  if (view.kind === "project") {
    return <SessionList project={view.project} onSelect={actions.selectSession} onBack={actions.goHome} />;
  }

  if (view.kind === "subagent") {
    return (
      <SessionList
        project={view.project}
        onSelect={actions.selectSession}
        onBack={actions.goHome}
        selectedId={view.sessionId}
      />
    );
  }

  return (
    <SessionList
      project={view.project}
      onSelect={actions.selectSession}
      onBack={actions.goHome}
      selectedId={view.session.sessionId}
    />
  );
}
