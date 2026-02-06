import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Project, SessionSummary } from "../shared/types.ts";
import { useTheme, useFontSize } from "./hooks/useTheme.ts";
import { Layout } from "./components/layout/Layout.tsx";
import { Header } from "./components/layout/Header.tsx";
import { ProjectList } from "./components/project/ProjectList.tsx";
import { SessionList } from "./components/project/SessionList.tsx";
import { SessionView } from "./components/session/SessionView.tsx";
import { SessionPresentation } from "./components/session/SessionPresentation.tsx";

type ViewState =
  | { kind: "home" }
  | { kind: "project"; project: Project }
  | {
      kind: "session";
      project: Project;
      session: SessionSummary;
      presenting: boolean;
    };

function App() {
  const { setting: themeSetting, cycle: cycleTheme } = useTheme();
  const { size: fontSize, increase, decrease } = useFontSize();
  const [view, setView] = useState<ViewState>({ kind: "home" });

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
  let headerTitle = "CCvie";
  let breadcrumb = "";
  if (view.kind === "project") {
    const parts = view.project.name.split("/").filter(Boolean);
    headerTitle = parts.slice(-2).join("/");
  } else if (view.kind === "session") {
    const parts = view.project.name.split("/").filter(Boolean);
    breadcrumb = parts.slice(-2).join("/");
    headerTitle = view.session.firstMessage || view.session.slug;
    if (headerTitle.length > 60) headerTitle = headerTitle.slice(0, 60) + "...";
  }

  // Sidebar content
  let sidebarContent: React.ReactNode;
  if (view.kind === "home") {
    sidebarContent = <ProjectList onSelect={selectProject} />;
  } else if (view.kind === "project") {
    sidebarContent = (
      <SessionList
        project={view.project}
        onSelect={selectSession}
        onBack={goHome}
      />
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
          <div className="empty-state-title">
            Select a project to get started
          </div>
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
          <SessionView
            sessionId={view.session.sessionId}
            project={view.project.encodedPath}
          />
        ))}
    </Layout>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
