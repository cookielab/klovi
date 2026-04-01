import { useCallback } from "react";
import "./SettingsView.css";

type SettingsTab = "general" | "plugins";

type SettingsSidebarProps = {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
	onBack?: (() => void) | undefined;
};

function SettingsSidebar({ activeTab, onTabChange, onBack }: SettingsSidebarProps) {
	const handleGeneralClick = useCallback(() => onTabChange("general"), [onTabChange]);
	const handlePluginsClick = useCallback(() => onTabChange("plugins"), [onTabChange]);

	return (
		<nav className="settings-nav">
			{onBack ? (
				<button type="button" className="settings-nav-back" onClick={onBack}>
					<span aria-hidden="true">&larr; </span>Back
				</button>
			) : null}
			<button
				type="button"
				className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
				onClick={handleGeneralClick}
			>
				General
			</button>
			<button
				type="button"
				className={`settings-nav-item ${activeTab === "plugins" ? "active" : ""}`}
				onClick={handlePluginsClick}
			>
				Plugins
			</button>
		</nav>
	);
}

// biome-ignore lint/style/useComponentExportOnlyModules: type-only export for tab discriminant
export type { SettingsTab };
export { SettingsSidebar };
