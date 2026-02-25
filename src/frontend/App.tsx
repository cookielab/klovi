import { ErrorBoundary } from "@cookielab.io/klovi-ui/utilities";
import { useCallback, useEffect, useState } from "react";
import faviconUrl from "../../favicon.svg";
import type { GlobalSessionResult } from "../shared/types.ts";
import { PackageDashboardStats } from "./components/dashboard/PackageDashboardStats.tsx";
import { Header } from "./components/layout/Header.tsx";
import { Layout } from "./components/layout/Layout.tsx";
import { PackageSubAgentView } from "./components/message/PackageSubAgentView.tsx";
import { PackageHiddenProjectList } from "./components/project/PackageHiddenProjectList.tsx";
import { PackageSearchModal } from "./components/search/PackageSearchModal.tsx";
import { SessionPresentation } from "./components/session/SessionPresentation.tsx";
import { SessionView } from "./components/session/SessionView.tsx";
import { SubAgentPresentation } from "./components/session/SubAgentPresentation.tsx";
import type { SettingsTab } from "./components/settings/SettingsSidebar.tsx";
import { SettingsView } from "./components/settings/SettingsView.tsx";
import { Onboarding } from "./components/ui/Onboarding.tsx";
import { SecurityWarning } from "./components/ui/SecurityWarning.tsx";
import { useHiddenProjects } from "./hooks/useHiddenProjects.ts";
import {
  resolveTheme,
  useFontSize,
  usePresentationFontSize,
  usePresentationTheme,
  useTheme,
} from "./hooks/useTheme.ts";
import { useViewState } from "./hooks/useViewState.ts";
import { getRPC } from "./rpc.ts";
import { getSidebarContent } from "./sidebar-content.tsx";
import { getHeaderInfo, getResumeCommand, resolveProjectAndSession } from "./view-state.ts";

export function App() {
  const themeHook = useTheme();
  const { cycle: cycleTheme } = themeHook;
  const fontSizeHook = useFontSize();
  const { increase, decrease } = fontSizeHook;
  const presentationThemeHook = usePresentationTheme();
  const presentationFontSizeHook = usePresentationFontSize();
  const { hiddenIds, hide, unhide } = useHiddenProjects();
  const {
    view,
    ready,
    setView,
    selectProject,
    selectSession,
    goHome,
    goHidden,
    goSettings,
    canPresent,
    togglePresentation,
  } = useViewState();

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSessions, setSearchSessions] = useState<GlobalSessionResult[]>([]);

  const fetchSearchSessions = useCallback(() => {
    getRPC()
      .request.searchSessions({} as Record<string, never>)
      .then((data) => setSearchSessions(data.sessions))
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
        setView({
          kind: "session",
          project: resolved.project,
          session: resolved.session,
          presenting: false,
        });
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

  // Cmd+, opens settings
  useEffect(() => {
    function handleCmdComma(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        if (view.kind === "settings") {
          history.back();
        } else {
          goSettings();
        }
      }
    }
    window.addEventListener("keydown", handleCmdComma);
    return () => window.removeEventListener("keydown", handleCmdComma);
  }, [view.kind, goSettings]);

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

  // Listen for Electrobun menu actions dispatched as CustomEvents
  useEffect(() => {
    const handleCycleTheme = () => cycleTheme();
    const handleIncrease = () => increase();
    const handleDecrease = () => decrease();
    const handleTogglePresentation = () => {
      if (canPresent) togglePresentation();
    };
    const handleOpenSettings = () => goSettings();

    window.addEventListener("klovi:cycleTheme", handleCycleTheme);
    window.addEventListener("klovi:increaseFontSize", handleIncrease);
    window.addEventListener("klovi:decreaseFontSize", handleDecrease);
    window.addEventListener("klovi:togglePresentation", handleTogglePresentation);
    window.addEventListener("klovi:openSettings", handleOpenSettings);

    return () => {
      window.removeEventListener("klovi:cycleTheme", handleCycleTheme);
      window.removeEventListener("klovi:increaseFontSize", handleIncrease);
      window.removeEventListener("klovi:decreaseFontSize", handleDecrease);
      window.removeEventListener("klovi:togglePresentation", handleTogglePresentation);
      window.removeEventListener("klovi:openSettings", handleOpenSettings);
    };
  }, [cycleTheme, increase, decrease, canPresent, togglePresentation, goSettings]);

  const { title: headerTitle, breadcrumb } = getHeaderInfo(view);
  const sidebarContent = getSidebarContent(view, hiddenIds, {
    selectProject,
    selectSession,
    goHome,
    goHidden,
    hide,
    settingsTab,
    setSettingsTab,
  });

  const isPresenting =
    view.kind === "session" || view.kind === "subagent" ? view.presenting : false;

  // Override theme/font-size when presenting with custom presentation values
  useEffect(() => {
    if (!isPresenting) return;

    if (!presentationThemeHook.sameAsGlobal) {
      const resolved = resolveTheme(presentationThemeHook.setting);
      document.documentElement.setAttribute("data-theme", resolved);
    }
    if (!presentationFontSizeHook.sameAsGlobal) {
      document.documentElement.style.setProperty(
        "--font-size-base",
        `${presentationFontSizeHook.size}px`,
      );
    }

    return () => {
      // Restore global values when exiting presentation
      document.documentElement.setAttribute("data-theme", themeHook.resolved);
      document.documentElement.style.setProperty("--font-size-base", `${fontSizeHook.size}px`);
    };
  }, [
    isPresenting,
    presentationThemeHook.sameAsGlobal,
    presentationThemeHook.setting,
    presentationFontSizeHook.sameAsGlobal,
    presentationFontSizeHook.size,
    themeHook.resolved,
    fontSizeHook.size,
  ]);

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {searchOpen && (
        <PackageSearchModal
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
          backHref={
            view.kind === "subagent" ? `#/${view.project.encodedPath}/${view.sessionId}` : undefined
          }
          sessionType={view.kind === "session" ? view.session.sessionType : undefined}
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
              <PackageDashboardStats />
            </>
          )}
          {view.kind === "hidden" && (
            <PackageHiddenProjectList hiddenIds={hiddenIds} onUnhide={unhide} onBack={goHome} />
          )}
          {view.kind === "settings" && (
            <SettingsView
              activeTab={settingsTab}
              onNavigateHome={goHome}
              theme={themeHook}
              fontSize={fontSizeHook}
              presentationTheme={presentationThemeHook}
              presentationFontSize={presentationFontSizeHook}
            />
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
                gitBranch={view.session.gitBranch}
              />
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
              <PackageSubAgentView
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

export function AppGate() {
  useTheme();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"onboarding" | "security-warning" | "none">("onboarding");

  const initialize = useCallback(() => {
    setAccepted(false);
    setLoading(true);
    setScreen("onboarding");
    getRPC()
      .request.isFirstLaunch({} as Record<string, never>)
      .then((data) => {
        if (data.firstLaunch) {
          setScreen("onboarding");
          return;
        }
        return getRPC()
          .request.getGeneralSettings({} as Record<string, never>)
          .then((settings) => {
            if (settings.showSecurityWarning) {
              setScreen("security-warning");
              return;
            }
            setScreen("none");
            return getRPC()
              .request.acceptRisks({} as Record<string, never>)
              .then(() => setAccepted(true))
              .catch(() => setAccepted(true));
          });
      })
      .catch(() => {
        setScreen("onboarding");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleReset = () => {
      window.location.hash = "#/";
      initialize();
    };
    window.addEventListener("klovi:reset", handleReset);
    return () => window.removeEventListener("klovi:reset", handleReset);
  }, [initialize]);

  const handleOnboardingComplete = useCallback(() => {
    getRPC()
      .request.acceptRisks({} as Record<string, never>)
      .then(() => setAccepted(true))
      .catch(() => setAccepted(true));
  }, []);

  const handleSecurityAccept = useCallback(() => {
    getRPC()
      .request.acceptRisks({} as Record<string, never>)
      .then(() => setAccepted(true))
      .catch(() => setAccepted(true));
  }, []);

  const handleDontShowAgain = useCallback(() => {
    getRPC()
      .request.updateGeneralSettings({ showSecurityWarning: false })
      .catch(() => {});
  }, []);

  if (loading) {
    return null;
  }

  if (!accepted && screen === "onboarding") {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!accepted && screen === "security-warning") {
    return (
      <SecurityWarning onAccept={handleSecurityAccept} onDontShowAgain={handleDontShowAgain} />
    );
  }

  if (!accepted) {
    return null;
  }

  return <App />;
}
