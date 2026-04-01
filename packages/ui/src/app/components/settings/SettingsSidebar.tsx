import "./SettingsView.css";

export type SettingsTab = "general" | "plugins";

type SettingsSidebarProps = {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
	onBack?: (() => void) | undefined;
};

export function SettingsSidebar({ activeTab, onTabChange, onBack }: SettingsSidebarProps) {
	return (
		<nav className="settings-nav">
			{onBack && (
				<button type="button" className="settings-nav-back" onClick={onBack}>
					<span aria-hidden="true">&larr; </span>Back
				</button>
			)}
			<button
				type="button"
				className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
				onClick={() => onTabChange("general")}
			>
				General
			</button>
			<button
				type="button"
				className={`settings-nav-item ${activeTab === "plugins" ? "active" : ""}`}
				onClick={() => onTabChange("plugins")}
			>
				Plugins
			</button>
		</nav>
	);
}
