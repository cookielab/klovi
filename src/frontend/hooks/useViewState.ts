import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Project, SessionSummary } from "../../shared/types.ts";
import { restoreFromHash, viewToHash, type ViewState } from "../view-state.ts";

interface UseViewStateResult {
  view: ViewState;
  ready: boolean;
  setView: Dispatch<SetStateAction<ViewState>>;
  selectProject: (project: Project) => void;
  selectSession: (session: SessionSummary) => void;
  goHome: () => void;
  goHidden: () => void;
  canPresent: boolean;
  togglePresentation: () => void;
}

export function useViewState(): UseViewStateResult {
  const [view, setView] = useState<ViewState>({ kind: "home" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreFromHash().then((v) => {
      setView(v);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const newHash = viewToHash(view);
    if (window.location.hash !== newHash) {
      history.pushState(null, "", newHash);
    }
  }, [view, ready]);

  useEffect(() => {
    const handler = () => {
      restoreFromHash().then(setView);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const selectProject = useCallback((project: Project) => {
    setView({ kind: "project", project });
  }, []);

  const selectSession = useCallback((session: SessionSummary) => {
    setView((current) => {
      if (current.kind === "project" || current.kind === "session") {
        return {
          kind: "session",
          project: current.project,
          session,
          presenting: false,
        };
      }
      return current;
    });
  }, []);

  const goHome = useCallback(() => setView({ kind: "home" }), []);
  const goHidden = useCallback(() => setView({ kind: "hidden" }), []);
  const canPresent = view.kind === "session" || view.kind === "subagent";

  const togglePresentation = useCallback(() => {
    setView((current) => {
      if (current.kind === "session" || current.kind === "subagent") {
        return { ...current, presenting: !current.presenting };
      }
      return current;
    });
  }, []);

  return {
    view,
    ready,
    setView,
    selectProject,
    selectSession,
    goHome,
    goHidden,
    canPresent,
    togglePresentation,
  };
}
