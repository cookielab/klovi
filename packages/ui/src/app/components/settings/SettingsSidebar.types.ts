export type SettingsTab = "general" | "plugins";

export type SettingsSidebarProps = {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
	onBack?: (() => void) | undefined;
};
