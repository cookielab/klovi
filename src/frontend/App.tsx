import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import faviconUrl from "../../favicon.svg";
import type { GlobalSessionResult, Project, SessionSummary } from "../shared/types.ts";
import { DashboardStats } from "./components/dashboard/DashboardStats.tsx";
import { Header } from "./components/layout/Header.tsx";
import { Layout } from "./components/layout/Layout.tsx";
import { SubAgentView } from "./components/message/SubAgentView.tsx";
import { HiddenProjectList } from "./components/project/HiddenProjectList.tsx";
import { ProjectList } from "./components/project/ProjectList.tsx";
import { SessionList } from "./components/project/SessionList.tsx";
import { SearchModal } from "./components/search/SearchModal.tsx";
import { SessionPresentation } from "./components/session/SessionPresentation.tsx";
import { SessionView } from "./components/session/SessionView.tsx";
import { SubAgentPresentation } from "./components/session/SubAgentPresentation.tsx";
import { ErrorBoundary } from "./components/ui/ErrorBoundary.tsx";
import { useHiddenProjects } from "./hooks/useHiddenProjects.ts";
import { useFontSize, useTheme } from "./hooks/useTheme.ts";

type ViewState =
  | { kind: "home" }
  | { kind: "hidden" }
  | { kind: "project"; project: Project }
  | {
      kind: "session";
      project: Project;
      session: SessionSummary;
      presenting: boolean;
    }
  | {
      kind: "subagent";
      project: Project;
      sessionId: string;
      agentId: string;
      presenting: boolean;
    };

function viewToHash(view: ViewState): string {
  if (view.kind === "hidden") return "#/hidden";
  if (view.kind === "project") return `#/${view.project.encodedPath}`;
  if (view.kind === "session") return `#/${view.project.encodedPath}/${view.session.sessionId}`;
  if (view.kind === "subagent")
    return `#/${view.project.encodedPath}/${view.sessionId}/subagent/${view.agentId}`;
  return "#/";
}

async function restoreFromHash(): Promise<ViewState> {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { kind: "home" };
  if (hash === "hidden") return { kind: "hidden" };

  const parts = hash.split("/");
  const encodedPath = parts[0];
  const sessionId = parts[1];
  const isSubAgent = parts[2] === "subagent" && parts[3];

  // Fetch project info
  let project: Project | undefined;
  try {
    const res = await fetch("/api/projects");
    const data = await res.json();
    project = data.projects.find((p: Project) => p.encodedPath === encodedPath);
  } catch {
    return { kind: "home" };
  }
  if (!project) return { kind: "home" };
  if (!sessionId) return { kind: "project", project };

  // Sub-agent route: #/<project>/<sessionId>/subagent/<agentId>
  if (isSubAgent) {
    return { kind: "subagent", project, sessionId, agentId: parts[3]!, presenting: false };
  }

  // Fetch session info
  try {
    const res = await fetch(`/api/projects/${encodedPath}/sessions`);
    const data = await res.json();
    const session = data.sessions.find((s: SessionSummary) => s.sessionId === sessionId);
    if (session) {
      return { kind: "session", project, session, presenting: false };
    }
  } catch {
    // fall through
  }
  return { kind: "project", project };
}

function getHeaderInfo(view: ViewState): { title: string; breadcrumb: string } {
  if (view.kind === "hidden") {
    return { title: "Hidden Projects", breadcrumb: "" };
  }
  if (view.kind === "project") {
    const parts = view.project.name.split("/").filter(Boolean);
    return { title: parts.slice(-2).join("/"), breadcrumb: "" };
  }
  if (view.kind === "session") {
    const parts = view.project.name.split("/").filter(Boolean);
    let title = view.session.firstMessage || view.session.slug;
    if (title.length > 60) title = `${title.slice(0, 60)}...`;
    return { title, breadcrumb: parts.slice(-2).join("/") };
  }
  if (view.kind === "subagent") {
    const parts = view.project.name.split("/").filter(Boolean);
    return {
      title: `Sub-agent ${view.agentId.slice(0, 8)}`,
      breadcrumb: parts.slice(-2).join("/"),
    };
  }
  return { title: "Klovi", breadcrumb: "" };
}

function getSidebarContent(
  view: ViewState,
  selectProject: (p: Project) => void,
  hiddenIds: Set<string>,
  hide: (id: string) => void,
  goHidden: () => void,
  selectSession: (s: SessionSummary) => void,
  goHome: () => void,
): React.ReactNode {
  if (view.kind === "home" || view.kind === "hidden") {
    return (
      <ProjectList
        onSelect={selectProject}
        hiddenIds={hiddenIds}
        onHide={hide}
        onShowHidden={goHidden}
      />
    );
  }
  if (view.kind === "project") {
    return <SessionList project={view.project} onSelect={selectSession} onBack={goHome} />;
  }
  if (view.kind === "subagent") {
    return (
      <SessionList
        project={view.project}
        onSelect={selectSession}
        onBack={goHome}
        selectedId={view.sessionId}
      />
    );
  }
  return (
    <SessionList
      project={view.project}
      onSelect={selectSession}
      onBack={goHome}
      selectedId={view.session.sessionId}
    />
  );
}

function App() {
  const { setting: themeSetting, cycle: cycleTheme } = useTheme();
  const { size: fontSize, increase, decrease } = useFontSize();
  const { hiddenIds, hide, unhide } = useHiddenProjects();
  const [view, setView] = useState<ViewState>({ kind: "home" });
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSessions, setSearchSessions] = useState<GlobalSessionResult[]>([]);

  // Restore view from URL hash on mount
  useEffect(() => {
    restoreFromHash().then((v) => {
      setView(v);
      setReady(true);
    });
  }, []);

  // Sync hash when view changes
  useEffect(() => {
    if (!ready) return;
    const newHash = viewToHash(view);
    if (window.location.hash !== newHash) {
      history.pushState(null, "", newHash);
    }
  }, [view, ready]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      restoreFromHash().then(setView);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const selectProject = (project: Project) => {
    setView({ kind: "project", project });
  };

  const selectSession = (session: SessionSummary) => {
    if (view.kind === "project" || view.kind === "session") {
      setView({
        kind: "session",
        project: view.project,
        session,
        presenting: false,
      });
    }
  };

  const goHome = () => setView({ kind: "home" });
  const goHidden = () => setView({ kind: "hidden" });
  const canPresent = view.kind === "session" || view.kind === "subagent";

  const togglePresentation = useCallback(() => {
    if (view.kind === "session" || view.kind === "subagent") {
      setView({ ...view, presenting: !view.presenting });
    }
  }, [view]);

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

  const handleSearchSelect = useCallback(async (encodedPath: string, sessionId: string) => {
    setSearchOpen(false);
    try {
      const [projectsRes, sessionsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch(`/api/projects/${encodedPath}/sessions`),
      ]);
      const projectsData = await projectsRes.json();
      const sessionsData = await sessionsRes.json();
      const project = projectsData.projects.find((p: Project) => p.encodedPath === encodedPath);
      const session = sessionsData.sessions.find((s: SessionSummary) => s.sessionId === sessionId);
      if (project && session) {
        setView({ kind: "session", project, session, presenting: false });
      }
    } catch {
      // ignore
    }
  }, []);

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
  const sidebarContent = getSidebarContent(
    view,
    selectProject,
    hiddenIds,
    hide,
    goHidden,
    selectSession,
    goHome,
  );

  const isPresenting = canPresent && view.presenting;

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
            view.kind === "session" ? `claude --resume ${view.session.sessionId}` : undefined
          }
          backHref={
            view.kind === "subagent" ? `#/${view.project.encodedPath}/${view.sessionId}` : undefined
          }
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
                <p>Select a project from the sidebar to browse your Claude Code sessions</p>
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
