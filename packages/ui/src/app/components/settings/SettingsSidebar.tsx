import { useCallback } from "react";

type SettingsTab = "general" | "plugins";

type SettingsSidebarProps = {
	activeTab: SettingsTab;
	onTabChange: (tab: SettingsTab) => void;
	onBack?: (() => void) | undefined;
};

const NAV_CLASSES = "flex flex-col gap-[2px]";
const NAV_BACK_CLASSES =
	"mb-1 cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-[0.85rem] text-foreground-subtle hover:text-foreground";
const NAV_ITEM_BASE_CLASSES =
	"w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-[0.9rem] text-foreground-muted hover:bg-surface-muted";
const NAV_ITEM_ACTIVE_CLASSES = "bg-accent-subtle font-medium text-accent";

function SettingsSidebar({ activeTab, onTabChange, onBack }: SettingsSidebarProps) {
	const handleGeneralClick = useCallback(() => onTabChange("general"), [onTabChange]);
	const handlePluginsClick = useCallback(() => onTabChange("plugins"), [onTabChange]);

	return (
		<nav className={NAV_CLASSES}>
			{onBack ? (
				<button type="button" className={NAV_BACK_CLASSES} onClick={onBack}>
					<span aria-hidden="true">&larr; </span>Back
				</button>
			) : null}
			<button
				type="button"
				className={`${NAV_ITEM_BASE_CLASSES} ${activeTab === "general" ? `active ${NAV_ITEM_ACTIVE_CLASSES}` : ""}`}
				onClick={handleGeneralClick}
			>
				General
			</button>
			<button
				type="button"
				className={`${NAV_ITEM_BASE_CLASSES} ${activeTab === "plugins" ? `active ${NAV_ITEM_ACTIVE_CLASSES}` : ""}`}
				onClick={handlePluginsClick}
			>
				Plugins
			</button>
		</nav>
	);
}

export type { SettingsTab };
export { SettingsSidebar };
