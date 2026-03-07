import "./SettingsView.css";

export type SettingsTab = "general" | "plugins";

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <nav className="settings-nav">
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
