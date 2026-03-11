import { ErrorBoundary } from "@cookielab.io/klovi-ui-components/utilities";
import { useCallback, useEffect, useState } from "react";
import faviconUrl from "../../favicon.svg";
import { useKloviClient, useKloviHostBridge } from "../lib/context.ts";
import { isRpcTransportError } from "../lib/rpc-errors.ts";
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
import { UpdateNotification } from "./components/UpdateNotification.tsx";
import { Onboarding } from "./components/ui/Onboarding.tsx";
import { SecurityWarning } from "./components/ui/SecurityWarning.tsx";
import {
  useGlobalShortcuts,
  useSearchShortcut,
  useSettingsShortcut,
} from "./hooks/useGlobalShortcuts.ts";
import { useHiddenProjects } from "./hooks/useHiddenProjects.ts";
import {
  resolveTheme,
  useFontSize,
  usePresentationFontSize,
  usePresentationTheme,
  useTheme,
} from "./hooks/useTheme.ts";
import { useUpdateStatus } from "./hooks/useUpdateStatus.ts";
import { useViewState } from "./hooks/useViewState.ts";
import { getSidebarContent } from "./sidebar-content.tsx";
import { getHeaderInfo, getResumeCommand, resolveProjectAndSession } from "./view-state.ts";

export function App() {
  const client = useKloviClient();
  const hostBridge = useKloviHostBridge();
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
    closeSettings,
    hostConnectionState,
    retryRestore,
  } = useViewState();

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSessions, setSearchSessions] = useState<GlobalSessionResult[]>([]);
  const { updateStatus, updateDismissed, dismissUpdate, manualCheckResult, dismissManualCheck } =
    useUpdateStatus();

  const fetchSearchSessions = useCallback(() => {
    client
      .searchSessions()
      .then((data) => setSearchSessions(data.sessions))
      .catch(() => {});
  }, [client]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    fetchSearchSessions();
  }, [fetchSearchSessions]);

  const handleSearchSelect = useCallback(
    async (encodedPath: string, sessionId: string) => {
      setSearchOpen(false);
      const resolved = await resolveProjectAndSession(client, encodedPath, sessionId);
      if (resolved) {
        setView({
          kind: "session",
          project: resolved.project,
          session: resolved.session,
          presenting: false,
        });
      }
    },
    [client, setView],
  );

  // Cmd+K / Ctrl+K toggles search
  useSearchShortcut({ fetchSearchSessions, setSearchOpen });

  // Cmd+, toggles settings
  useSettingsShortcut({ isSettings: view.kind === "settings", closeSettings, goSettings });

  // Global keyboard shortcuts: p = toggle presentation, +/- = font size
  useGlobalShortcuts({ canPresent, togglePresentation, increase, decrease });

  // Listen for host bridge menu actions
  useEffect(() => {
    return hostBridge.onMenuAction((action) => {
      switch (action) {
        case "cycleTheme":
          cycleTheme();
          break;
        case "increaseFontSize":
          increase();
          break;
        case "decreaseFontSize":
          decrease();
          break;
        case "togglePresentation":
          if (canPresent) togglePresentation();
          break;
        case "openSettings":
          goSettings();
          break;
      }
    });
  }, [hostBridge, cycleTheme, increase, decrease, canPresent, togglePresentation, goSettings]);

  const { title: headerTitle, breadcrumb } = getHeaderInfo(view);
  const headerOnBackMap: Partial<Record<string, () => void>> = { settings: closeSettings };
  const headerOnBack = headerOnBackMap[view.kind];
  const sidebarContent = getSidebarContent(view, hiddenIds, {
    selectProject,
    selectSession,
    goHome,
    goHidden,
    hide,
    settingsTab,
    setSettingsTab,
    closeSettings,
    hostConnectionState,
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
      <Layout
        sidebar={sidebarContent}
        hideSidebar={isPresenting}
        onSearchClick={openSearch}
        onSettingsClick={goSettings}
      >
        <Header
          title={headerTitle}
          breadcrumb={breadcrumb}
          onBack={headerOnBack}
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
        <UpdateNotification
          status={updateStatus}
          dismissed={updateDismissed}
          onDismiss={dismissUpdate}
          manualCheckResult={manualCheckResult}
          onDismissManualCheck={dismissManualCheck}
        />
        <AppMainContent
          view={view}
          hiddenIds={hiddenIds}
          unhide={unhide}
          goHome={goHome}
          closeSettings={closeSettings}
          settingsTab={settingsTab}
          themeHook={themeHook}
          fontSizeHook={fontSizeHook}
          presentationThemeHook={presentationThemeHook}
          presentationFontSizeHook={presentationFontSizeHook}
          togglePresentation={togglePresentation}
          hostConnectionState={hostConnectionState}
          retryRestore={retryRestore}
        />
      </Layout>
    </>
  );
}

interface AppMainContentProps {
  view: ReturnType<typeof useViewState>["view"];
  hiddenIds: Set<string>;
  unhide: (encodedPath: string) => void;
  goHome: () => void;
  closeSettings: () => void;
  settingsTab: SettingsTab;
  themeHook: ReturnType<typeof useTheme>;
  fontSizeHook: ReturnType<typeof useFontSize>;
  presentationThemeHook: ReturnType<typeof usePresentationTheme>;
  presentationFontSizeHook: ReturnType<typeof usePresentationFontSize>;
  togglePresentation: () => void;
  hostConnectionState: ReturnType<typeof useViewState>["hostConnectionState"];
  retryRestore: () => void;
}

function AppMainContent({
  view,
  hiddenIds,
  unhide,
  goHome,
  closeSettings,
  settingsTab,
  themeHook,
  fontSizeHook,
  presentationThemeHook,
  presentationFontSizeHook,
  togglePresentation,
  hostConnectionState,
  retryRestore,
}: AppMainContentProps) {
  return (
    <ErrorBoundary>
      {view.kind === "restoring" && (
        <DesktopHostReconnectPanel
          title={
            hostConnectionState === "connected"
              ? "Restoring selected session..."
              : "Reconnecting to Klovi desktop host..."
          }
          description="Klovi is waiting for the desktop bridge before restoring the current project or session."
          actionLabel="Retry"
          onAction={retryRestore}
        />
      )}
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
          onNavigateHome={closeSettings}
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
  );
}

export function AppGate() {
  useTheme();
  const client = useKloviClient();
  const hostBridge = useKloviHostBridge();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<"connecting" | "onboarding" | "security-warning" | "none">(
    "onboarding",
  );
  const isDesktopHost = hostBridge.getCapabilities().desktop;

  const initialize = useCallback(() => {
    setAccepted(false);
    setLoading(true);
    setScreen("onboarding");
    client
      .isFirstLaunch()
      .then((data) => {
        if (data.firstLaunch) {
          setScreen("onboarding");
          return;
        }
        return client.getGeneralSettings().then((settings) => {
          if (settings.showSecurityWarning) {
            setScreen("security-warning");
            return;
          }
          setScreen("none");
          return client
            .acceptRisks()
            .then(() => setAccepted(true))
            .catch((error) => {
              if (isDesktopHost && isRpcTransportError(error)) {
                setScreen("connecting");
                return;
              }
              setAccepted(true);
            });
        });
      })
      .catch((error) => {
        if (isDesktopHost && isRpcTransportError(error)) {
          setScreen("connecting");
          return;
        }
        setScreen("onboarding");
      })
      .finally(() => setLoading(false));
  }, [client, isDesktopHost]);

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
    client
      .acceptRisks()
      .then(() => setAccepted(true))
      .catch((error) => {
        if (isDesktopHost && isRpcTransportError(error)) {
          setScreen("connecting");
          return;
        }
        setAccepted(true);
      });
  }, [client, isDesktopHost]);

  const handleSecurityAccept = useCallback(() => {
    client
      .acceptRisks()
      .then(() => setAccepted(true))
      .catch((error) => {
        if (isDesktopHost && isRpcTransportError(error)) {
          setScreen("connecting");
          return;
        }
        setAccepted(true);
      });
  }, [client, isDesktopHost]);

  const handleDontShowAgain = useCallback(() => {
    client.updateGeneralSettings({ showSecurityWarning: false }).catch(() => {});
  }, [client]);

  if (loading) {
    return null;
  }

  if (!accepted && screen === "onboarding") {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!accepted && screen === "connecting") {
    return (
      <DesktopHostReconnectPanel
        title="Connecting to Klovi desktop host..."
        description="The desktop runtime is still reconnecting. Retry once the host bridge is available again."
        actionLabel="Retry"
        onAction={initialize}
      />
    );
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

interface DesktopHostReconnectPanelProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

function DesktopHostReconnectPanel({
  title,
  description,
  actionLabel,
  onAction,
}: DesktopHostReconnectPanelProps) {
  return (
    <section className="empty-state">
      <img src={faviconUrl} alt="" width="64" height="64" className="empty-state-logo" />
      <div className="empty-state-title">{title}</div>
      <p>{description}</p>
      <button type="button" className="security-warning-button" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  );
}
