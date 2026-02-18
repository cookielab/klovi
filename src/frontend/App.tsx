import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import faviconUrl from "../../favicon.svg";
import type { GlobalSessionResult } from "../shared/types.ts";
import { DashboardStats } from "./components/dashboard/DashboardStats.tsx";
import { Header } from "./components/layout/Header.tsx";
import { Layout } from "./components/layout/Layout.tsx";
import { SubAgentView } from "./components/message/SubAgentView.tsx";
import { HiddenProjectList } from "./components/project/HiddenProjectList.tsx";
import { SearchModal } from "./components/search/SearchModal.tsx";
import { SessionPresentation } from "./components/session/SessionPresentation.tsx";
import { SessionView } from "./components/session/SessionView.tsx";
import { SubAgentPresentation } from "./components/session/SubAgentPresentation.tsx";
import { ErrorBoundary } from "./components/ui/ErrorBoundary.tsx";
import { useHiddenProjects } from "./hooks/useHiddenProjects.ts";
import { useFontSize, useTheme } from "./hooks/useTheme.ts";
import { useViewState } from "./hooks/useViewState.ts";
import { getSidebarContent } from "./sidebar-content.tsx";
import { getHeaderInfo, getResumeCommand, resolveProjectAndSession } from "./view-state.ts";

function App() {
  const { setting: themeSetting, cycle: cycleTheme } = useTheme();
  const { size: fontSize, increase, decrease } = useFontSize();
  const { hiddenIds, hide, unhide } = useHiddenProjects();
  const {
    view,
    ready,
    setView,
    selectProject,
    selectSession,
    goHome,
    goHidden,
    canPresent,
    togglePresentation,
  } = useViewState();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSessions, setSearchSessions] = useState<GlobalSessionResult[]>([]);

  const fetchSearchSessions = useCallback(() => {
    fetch("/api/search/sessions")
      .then((res) => res.json())
      .then((data: { sessions: GlobalSessionResult[] }) => setSearchSessions(data.sessions))
      .catch(() => {});
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    fetchSearchSessions();
  }, [fetchSearchSessions]);

  const handleSearchSelect = useCallback(
    async (encodedPath: string, sessionId: string) => {
      setSearchOpen(false);
      const resolved = await resolveProjectAndSession(encodedPath, sessionId);
      if (resolved) {
        setView({ kind: "session", project: resolved.project, session: resolved.session, presenting: false });
      }
    },
    [setView],
  );

  // Cmd+K / Ctrl+K toggles search
  useEffect(() => {
    function handleCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => {
          if (!prev) fetchSearchSessions();
          return !prev;
        });
      }
    }
    window.addEventListener("keydown", handleCmdK);
    return () => window.removeEventListener("keydown", handleCmdK);
  }, [fetchSearchSessions]);

  // Global keyboard shortcuts: p = toggle presentation, +/- = font size
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case "p":
          if (canPresent) {
            e.preventDefault();
            togglePresentation();
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          increase();
          break;
        case "-":
          e.preventDefault();
          decrease();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canPresent, togglePresentation, increase, decrease]);

  const { title: headerTitle, breadcrumb } = getHeaderInfo(view);
  const sidebarContent = getSidebarContent(view, hiddenIds, {
    selectProject,
    selectSession,
    goHome,
    goHidden,
    hide,
  });

  const isPresenting = view.kind === "session" || view.kind === "subagent" ? view.presenting : false;

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {searchOpen && (
        <SearchModal
          sessions={searchSessions}
          onSelect={handleSearchSelect}
          onClose={() => setSearchOpen(false)}
        />
      )}
      <Layout sidebar={sidebarContent} hideSidebar={isPresenting} onSearchClick={openSearch}>
        <Header
          title={headerTitle}
          breadcrumb={breadcrumb}
          copyCommand={
            view.kind === "session"
              ? getResumeCommand(view.session.pluginId, view.session.sessionId)
              : undefined
          }
          backHref={view.kind === "subagent" ? `#/${view.project.encodedPath}/${view.sessionId}` : undefined}
          sessionType={view.kind === "session" ? view.session.sessionType : undefined}
          themeSetting={themeSetting}
          onCycleTheme={cycleTheme}
          fontSize={fontSize}
          onIncreaseFontSize={increase}
          onDecreaseFontSize={decrease}
          presentationActive={isPresenting}
          onTogglePresentation={togglePresentation}
          showPresentationToggle={canPresent}
        />
        <ErrorBoundary>
          {view.kind === "home" && (
            <>
              <div className="empty-state">
                <img src={faviconUrl} alt="" width="64" height="64" className="empty-state-logo" />
                <div className="empty-state-title">Welcome to Klovi</div>
                <p>Select a project from the sidebar to browse your AI coding sessions</p>
              </div>
              <DashboardStats />
            </>
          )}
          {view.kind === "hidden" && (
            <HiddenProjectList hiddenIds={hiddenIds} onUnhide={unhide} onBack={goHome} />
          )}
          {view.kind === "project" && (
            <div className="empty-state">
              <div className="empty-state-title">Select a session</div>
              <p>Choose a conversation from the sidebar</p>
            </div>
          )}
          {view.kind === "session" &&
            (view.presenting ? (
              <SessionPresentation
                sessionId={view.session.sessionId}
                project={view.project.encodedPath}
                onExit={togglePresentation}
              />
            ) : (
              <SessionView sessionId={view.session.sessionId} project={view.project.encodedPath} />
            ))}
          {view.kind === "subagent" &&
            (view.presenting ? (
              <SubAgentPresentation
                sessionId={view.sessionId}
                project={view.project.encodedPath}
                agentId={view.agentId}
                onExit={togglePresentation}
              />
            ) : (
              <SubAgentView
                sessionId={view.sessionId}
                project={view.project.encodedPath}
                agentId={view.agentId}
              />
            ))}
        </ErrorBoundary>
      </Layout>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
