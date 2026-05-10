import type React from "react";
import type { KloviHostConnectionState } from "../lib/host-bridge";
import type { Project, SessionSummary } from "../shared/types";
import { PackageProjectList } from "./components/project/PackageProjectList";
import { PackageSessionList } from "./components/project/PackageSessionList";
import { SettingsSidebar, type SettingsTab } from "./components/settings/SettingsSidebar";
import type { ViewState } from "./view-state";

type SidebarActions = {
	selectProject: (p: Project) => void;
	selectSession: (s: SessionSummary) => void;
	goHome: () => void;
	goHidden: () => void;
	hide: (id: string) => void;
	settingsTab: SettingsTab;
	setSettingsTab: (tab: SettingsTab) => void;
	closeSettings: () => void;
	hostConnectionState: KloviHostConnectionState;
};

export function getSidebarContent(view: ViewState, hiddenIds: Set<string>, actions: SidebarActions): React.ReactNode {
	if (view.kind === "settings") {
		return (
			<SettingsSidebar
				activeTab={actions.settingsTab}
				onTabChange={actions.setSettingsTab}
				onBack={actions.closeSettings}
			/>
		);
	}

	if (view.kind === "home" || view.kind === "hidden") {
		return (
			<PackageProjectList
				onSelect={actions.selectProject}
				hiddenIds={hiddenIds}
				onHide={actions.hide}
				onShowHidden={actions.goHidden}
			/>
		);
	}

	if (view.kind === "restoring") {
		return (
			<div className="loading flex items-center justify-center p-10 text-[0.9rem] text-foreground-subtle">
				{actions.hostConnectionState === "connected" ? "Restoring selection..." : "Reconnecting to desktop host..."}
			</div>
		);
	}

	if (view.kind === "project") {
		return <PackageSessionList project={view.project} onSelect={actions.selectSession} onBack={actions.goHome} />;
	}

	if (view.kind === "subagent") {
		return (
			<PackageSessionList
				project={view.project}
				onSelect={actions.selectSession}
				onBack={actions.goHome}
				selectedId={view.sessionId}
			/>
		);
	}

	return (
		<PackageSessionList
			project={view.project}
			onSelect={actions.selectSession}
			onBack={actions.goHome}
			selectedId={view.session.sessionId}
		/>
	);
}
