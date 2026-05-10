import { Text } from "@cookielab.io/klovi-design-system";
import { ErrorBoundary } from "@cookielab.io/klovi-ui-components/utilities";
import { useCallback, useEffect, useState } from "react";
import faviconUrl from "../../favicon.svg";
import { useKloviClient, useKloviHostBridge, useRunKloviEffect } from "../lib/context";
import { isTransportRpcError } from "../lib/rpc-errors-effect";
import type { GlobalSessionResult } from "../shared/types";
import { PackageDashboardStats } from "./components/dashboard/PackageDashboardStats";
import { Header } from "./components/layout/Header";
import { Layout } from "./components/layout/Layout";
import { PackageSubAgentView } from "./components/message/PackageSubAgentView";
import { PackageHiddenProjectList } from "./components/project/PackageHiddenProjectList";
import { PackageSearchModal } from "./components/search/PackageSearchModal";
import { SessionPresentation } from "./components/session/SessionPresentation";
import { SessionView } from "./components/session/SessionView";
import { SubAgentPresentation } from "./components/session/SubAgentPresentation";
import type { SettingsTab } from "./components/settings/SettingsSidebar";
import { SettingsView } from "./components/settings/SettingsView";
import { UpdateNotification } from "./components/UpdateNotification";
import { Onboarding } from "./components/ui/Onboarding";
import { SecurityWarning } from "./components/ui/SecurityWarning";
import { useGlobalShortcuts, useSearchShortcut, useSettingsShortcut } from "./hooks/useGlobalShortcuts";
import { useHiddenProjects } from "./hooks/useHiddenProjects";
import {
	resolveTheme,
	useFontSize,
	usePresentationFontSize,
	usePresentationTheme,
	useSystemThemeOverride,
	useTheme,
} from "./hooks/useTheme";
import { useUpdateStatus } from "./hooks/useUpdateStatus";
import { useViewState } from "./hooks/useViewState";
import { getSidebarContent } from "./sidebar-content";
import { getHeaderInfo, getResumeCommand, resolveProjectAndSessionEffect } from "./view-state";


const T_LOADING = "Loading...";
const T_WELCOME_TO_KLOVI = "Welcome to Klovi";
const T_SELECT_A_PROJECT_FROM_THE_SIDE = "Select a project from the sidebar to browse your AI coding sessions";
const T_SELECT_A_SESSION = "Select a session";
const T_CHOOSE_A_CONVERSATION_FROM_THE = "Choose a conversation from the sidebar";

const LOADING_CLASSES = "loading flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle";
const EMPTY_STATE_CLASSES =
	"empty-state flex flex-col items-center justify-center px-5 py-[60px] text-center text-foreground-subtle";
const EMPTY_STATE_LOGO_CLASSES = "empty-state-logo mb-4 opacity-70";
const EMPTY_STATE_TITLE_CLASSES = "empty-state-title mb-2 text-[1.2rem] font-semibold text-foreground-muted";
const HOST_RECONNECT_BUTTON_CLASSES =
	"mt-6 cursor-pointer border-0 bg-accent px-8 py-[10px] font-sans text-[0.95rem] font-medium text-foreground-inverse transition-[background] duration-150 hover:bg-accent-hover";

function App() {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const runKloviEffect = useRunKloviEffect();
	const systemThemeOverride = useSystemThemeOverride();
	const themeHook = useTheme({ systemThemeOverride: systemThemeOverride });
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
	const { updateStatus, updateDismissed, dismissUpdate, manualCheckResult, dismissManualCheck } = useUpdateStatus();

	const fetchSearchSessions = useCallback(() => {
		runKloviEffect(client.searchSessions())
			.then((data) => setSearchSessions(data.sessions))
			.catch(() => undefined);
	}, [client, runKloviEffect]);

	const openSearch = useCallback(() => {
		setSearchOpen(true);
		fetchSearchSessions();
	}, [fetchSearchSessions]);

	const closeSearch = useCallback(() => setSearchOpen(false), []);

	const handleSearchSelect = useCallback(
		async (encodedPath: string, sessionId: string) => {
			setSearchOpen(false);
			const resolved = await runKloviEffect(resolveProjectAndSessionEffect(encodedPath, sessionId));
			if (resolved) {
				setView({
					kind: "session",
					project: resolved.project,
					session: resolved.session,
					presenting: false,
				});
			}
		},
		[runKloviEffect, setView],
	);

	// Cmd+K / Ctrl+K toggles search
	useSearchShortcut({ fetchSearchSessions: fetchSearchSessions, setSearchOpen: setSearchOpen });

	// Cmd+, toggles settings
	useSettingsShortcut({ isSettings: view.kind === "settings", closeSettings: closeSettings, goSettings: goSettings });

	// Global keyboard shortcuts: p = toggle presentation, +/- = font size
	useGlobalShortcuts({
		canPresent: canPresent,
		togglePresentation: togglePresentation,
		increase: increase,
		decrease: decrease,
	});

	// Listen for host bridge menu actions
	useEffect(
		() =>
			hostBridge.onMenuAction((action) => {
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
						if (canPresent) {
							togglePresentation();
						}
						break;
					case "openSettings":
						goSettings();
						break;
					default:
						break;
				}
			}),
		[hostBridge, cycleTheme, increase, decrease, canPresent, togglePresentation, goSettings],
	);

	const { title: headerTitle, breadcrumb } = getHeaderInfo(view);
	const headerOnBackMap: Partial<Record<string, () => void>> = { settings: closeSettings };
	const headerOnBack = headerOnBackMap[view.kind];
	const sidebarContent = getSidebarContent(view, hiddenIds, {
		selectProject: selectProject,
		selectSession: selectSession,
		goHome: goHome,
		goHidden: goHidden,
		hide: hide,
		settingsTab: settingsTab,
		setSettingsTab: setSettingsTab,
		closeSettings: closeSettings,
		hostConnectionState: hostConnectionState,
	});

	const isPresenting = view.kind === "session" || view.kind === "subagent" ? view.presenting : false;

	// Override theme/font-size when presenting with custom presentation values
	useEffect(() => {
		if (!isPresenting) {
			return;
		}

		if (!presentationThemeHook.sameAsGlobal) {
			const resolved = resolveTheme(presentationThemeHook.setting, systemThemeOverride);
			document.documentElement.setAttribute("data-theme", resolved);
		}
		if (!presentationFontSizeHook.sameAsGlobal) {
			document.documentElement.style.setProperty("--font-size-base", `${presentationFontSizeHook.size}px`);
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
		systemThemeOverride,
	]);

	if (!ready) {
		return <div className={LOADING_CLASSES}><Text>{T_LOADING}</Text></div>;
	}

	return (
		<>
			{searchOpen ? (
				<PackageSearchModal sessions={searchSessions} onSelect={handleSearchSelect} onClose={closeSearch} />
			) : null}
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
						view.kind === "session" ? getResumeCommand(view.session.pluginId, view.session.sessionId) : undefined
					}
					backHref={view.kind === "subagent" ? `#/${view.project.encodedPath}/${view.sessionId}` : undefined}
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

type AppMainContentProps = {
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
};

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
					<div className={EMPTY_STATE_CLASSES}>
						<img src={faviconUrl} alt="" width="64" height="64" className={EMPTY_STATE_LOGO_CLASSES} />
						<div className={EMPTY_STATE_TITLE_CLASSES}><Text>{T_WELCOME_TO_KLOVI}</Text></div>
						<p><Text>{T_SELECT_A_PROJECT_FROM_THE_SIDE}</Text></p>
					</div>
					<PackageDashboardStats />
				</>
			)}
			{view.kind === "hidden" && <PackageHiddenProjectList hiddenIds={hiddenIds} onUnhide={unhide} onBack={goHome} />}
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
				<div className={EMPTY_STATE_CLASSES}>
					<div className={EMPTY_STATE_TITLE_CLASSES}><Text>{T_SELECT_A_SESSION}</Text></div>
					<p><Text>{T_CHOOSE_A_CONVERSATION_FROM_THE}</Text></p>
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
					<PackageSubAgentView sessionId={view.sessionId} project={view.project.encodedPath} agentId={view.agentId} />
				))}
		</ErrorBoundary>
	);
}

function AppGate() {
	const systemThemeOverride = useSystemThemeOverride();
	useTheme({ systemThemeOverride: systemThemeOverride });
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const runKloviEffect = useRunKloviEffect();
	const [accepted, setAccepted] = useState(false);
	const [loading, setLoading] = useState(true);
	const [screen, setScreen] = useState<"connecting" | "onboarding" | "security-warning" | "none">("onboarding");
	const isDesktopHost = hostBridge.getCapabilities().desktop;

	const initialize = useCallback(async () => {
		setAccepted(false);
		setLoading(true);
		setScreen("onboarding");
		try {
			const data = await runKloviEffect(client.isFirstLaunch());
			if (data.firstLaunch) {
				setScreen("onboarding");
				return;
			}
			const settings = await runKloviEffect(client.getGeneralSettings());
			if (settings.showSecurityWarning) {
				setScreen("security-warning");
				return;
			}
			setScreen("none");
			try {
				await runKloviEffect(client.acceptRisks());
				setAccepted(true);
			} catch (error) {
				if (isDesktopHost && isTransportRpcError(error)) {
					setScreen("connecting");
					return;
				}
				setAccepted(true);
			}
		} catch (error) {
			if (isDesktopHost && isTransportRpcError(error)) {
				setScreen("connecting");
				return;
			}
			setScreen("onboarding");
		} finally {
			setLoading(false);
		}
	}, [client, isDesktopHost, runKloviEffect]);

	useEffect(() => {
		initialize();
	}, [initialize]);

	useEffect(() => {
		const handleReset = () => {
			globalThis.location.hash = "#/";
			initialize();
		};
		globalThis.addEventListener("klovi:reset", handleReset);
		return () => globalThis.removeEventListener("klovi:reset", handleReset);
	}, [initialize]);

	const handleOnboardingComplete = useCallback(() => {
		runKloviEffect(client.acceptRisks())
			.then(() => setAccepted(true))
			.catch((error) => {
				if (isDesktopHost && isTransportRpcError(error)) {
					setScreen("connecting");
					return;
				}
				setAccepted(true);
			});
	}, [client, isDesktopHost, runKloviEffect]);

	const handleSecurityAccept = useCallback(() => {
		runKloviEffect(client.acceptRisks())
			.then(() => setAccepted(true))
			.catch((error) => {
				if (isDesktopHost && isTransportRpcError(error)) {
					setScreen("connecting");
					return;
				}
				setAccepted(true);
			});
	}, [client, isDesktopHost, runKloviEffect]);

	const handleDontShowAgain = useCallback(() => {
		runKloviEffect(client.updateGeneralSettings({ showSecurityWarning: false })).catch(() => undefined);
	}, [client, runKloviEffect]);

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
		return <SecurityWarning onAccept={handleSecurityAccept} onDontShowAgain={handleDontShowAgain} />;
	}

	if (!accepted) {
		return null;
	}

	return <App />;
}

type DesktopHostReconnectPanelProps = {
	title: string;
	description: string;
	actionLabel: string;
	onAction: () => void;
};

function DesktopHostReconnectPanel({ title, description, actionLabel, onAction }: DesktopHostReconnectPanelProps) {
	return (
		<section className={EMPTY_STATE_CLASSES}>
			<img src={faviconUrl} alt="" width="64" height="64" className={EMPTY_STATE_LOGO_CLASSES} />
			<div className={EMPTY_STATE_TITLE_CLASSES}>{title}</div>
			<p>{description}</p>
			<button type="button" className={HOST_RECONNECT_BUTTON_CLASSES} onClick={onAction}>
				{actionLabel}
			</button>
		</section>
	);
}

export { App, AppGate };
