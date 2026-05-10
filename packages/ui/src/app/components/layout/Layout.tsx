import type React from "react";
import { Sidebar } from "./Sidebar";

type LayoutProps = {
	sidebar: React.ReactNode;
	hideSidebar?: boolean;
	onSearchClick?: () => void;
	onSettingsClick?: () => void;
	children: React.ReactNode;
};

const LAYOUT_CLASSES = "app-layout flex min-h-screen";
const MAIN_CONTENT_CLASSES =
	"main-content ml-sidebar flex min-h-screen flex-1 flex-col transition-[margin-left] duration-200 ease-[ease]";
const MAIN_CONTENT_HIDDEN_CLASSES = "ml-0!";

export function Layout({ sidebar, hideSidebar, onSearchClick, onSettingsClick, children }: LayoutProps) {
	return (
		<div className={`${LAYOUT_CLASSES} ${hideSidebar ? "sidebar-hidden" : ""}`}>
			<Sidebar hidden={hideSidebar} onSearchClick={onSearchClick} onSettingsClick={onSettingsClick}>
				{sidebar}
			</Sidebar>
			<div className={`${MAIN_CONTENT_CLASSES} ${hideSidebar ? MAIN_CONTENT_HIDDEN_CLASSES : ""}`}>{children}</div>
		</div>
	);
}
