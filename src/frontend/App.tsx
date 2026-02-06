import type React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Project, SessionSummary } from "../shared/types.ts";
import { Header } from "./components/layout/Header.tsx";
import { Layout } from "./components/layout/Layout.tsx";
import { ProjectList } from "./components/project/ProjectList.tsx";
import { SessionList } from "./components/project/SessionList.tsx";
import { SessionPresentation } from "./components/session/SessionPresentation.tsx";
import { SessionView } from "./components/session/SessionView.tsx";
import { useFontSize, useTheme } from "./hooks/useTheme.ts";

type ViewState =
  | { kind: "home" }
  | { kind: "project"; project: Project }
  | {
      kind: "session";
      project: Project;
      session: SessionSummary;
      presenting: boolean;
    };

function viewToHash(view: ViewState): string {
  if (view.kind === "project") return `#/${view.project.encodedPath}`;
  if (view.kind === "session") return `#/${view.project.encodedPath}/${view.session.sessionId}`;
  return "#/";
}

async function restoreFromHash(): Promise<ViewState> {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { kind: "home" };

  const parts = hash.split("/");
  const encodedPath = parts[0];
  const sessionId = parts[1];

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

function App() {
  const { setting: themeSetting, cycle: cycleTheme } = useTheme();
  const { size: fontSize, increase, decrease } = useFontSize();
  const [view, setView] = useState<ViewState>({ kind: "home" });
  const [ready, setReady] = useState(false);

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

  const togglePresentation = () => {
    if (view.kind === "session") {
      setView({ ...view, presenting: !view.presenting });
    }
  };

  // Determine header title
  let headerTitle = "Klovi";
  let breadcrumb = "";
  if (view.kind === "project") {
    const parts = view.project.name.split("/").filter(Boolean);
    headerTitle = parts.slice(-2).join("/");
  } else if (view.kind === "session") {
    const parts = view.project.name.split("/").filter(Boolean);
    breadcrumb = parts.slice(-2).join("/");
    headerTitle = view.session.firstMessage || view.session.slug;
    if (headerTitle.length > 60) headerTitle = `${headerTitle.slice(0, 60)}...`;
  }

  // Sidebar content
  let sidebarContent: React.ReactNode;
  if (view.kind === "home") {
    sidebarContent = <ProjectList onSelect={selectProject} />;
  } else if (view.kind === "project") {
    sidebarContent = (
      <SessionList project={view.project} onSelect={selectSession} onBack={goHome} />
    );
  } else {
    sidebarContent = (
      <SessionList
        project={view.project}
        onSelect={selectSession}
        onBack={goHome}
        selectedId={view.session.sessionId}
      />
    );
  }

  const isPresenting = view.kind === "session" && view.presenting;

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Layout sidebar={sidebarContent} hideSidebar={isPresenting}>
      <Header
        title={headerTitle}
        breadcrumb={breadcrumb}
        themeSetting={themeSetting}
        onCycleTheme={cycleTheme}
        fontSize={fontSize}
        onIncreaseFontSize={increase}
        onDecreaseFontSize={decrease}
        presentationActive={isPresenting}
        onTogglePresentation={togglePresentation}
        showPresentationToggle={view.kind === "session"}
      />
      {view.kind === "home" && (
        <div className="empty-state">
          <div className="empty-state-title">Select a project to get started</div>
          <p>Browse your Claude Code sessions from the sidebar</p>
        </div>
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
    </Layout>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
