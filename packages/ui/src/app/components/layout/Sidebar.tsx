import { SidebarButton } from "@cookielab.io/klovi-design-system";
import { formatShortcut } from "@cookielab.io/klovi-ui-components/utilities";
import type React from "react";
import { useCallback } from "react";
import faviconUrl from "../../../../favicon.svg";
import { useKloviClient, useRunKloviEffect } from "../../../lib/context.ts";
import { kloviHostBridge } from "../../../lib/rpc-client.ts";
import { useEffectQuery } from "../../hooks/useEffectQuery.ts";

type VersionInfo = {
	version: string;
	commit: string;
};

type SidebarProps = {
	children: React.ReactNode;
	hidden?: boolean | undefined;
	onSearchClick?: (() => void) | undefined;
	onSettingsClick?: (() => void) | undefined;
};

const SIDEBAR_BASE_CLASSES =
	"fixed top-0 left-0 z-10 flex h-screen w-sidebar flex-col overflow-hidden border-border border-r bg-surface-muted transition-transform duration-200 ease-[ease]";
const SIDEBAR_HIDDEN_CLASSES = "-translate-x-full";
const HEADER_CLASSES = "flex h-header flex-shrink-0 items-center gap-3 border-border border-b px-4";
const TITLE_CLASSES = "text-[1.1rem] font-bold text-foreground";
const VERSION_CLASSES =
	"sidebar-version inline-flex shrink-0 items-center whitespace-nowrap bg-surface-sunken px-[6px] py-px font-mono text-[0.68rem] leading-[1.4] text-foreground-subtle";
const CONTENT_CLASSES = "flex-1 overflow-y-auto p-2";
const FOOTER_CLASSES =
	"sidebar-footer flex-shrink-0 border-border-muted border-t px-4 py-[10px] text-center text-[0.7rem] text-foreground-subtle [&_a]:text-foreground-subtle [&_a]:no-underline [&_a:hover]:text-accent";

export function Sidebar({ children, hidden, onSearchClick, onSettingsClick }: SidebarProps) {
	const client = useKloviClient();
	const runKloviEffect = useRunKloviEffect();
	const { data: versionInfo } = useEffectQuery<VersionInfo>(() => client.getVersion(), [client]);

	const handleCookielabClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			runKloviEffect(
				kloviHostBridge.openExternal({
					url: "https://cookielab.io?utm_source=opensource&utm_medium=klovi",
				}),
			).catch(() => {});
		},
		[runKloviEffect],
	);

	return (
		<div className={`${SIDEBAR_BASE_CLASSES} ${hidden ? SIDEBAR_HIDDEN_CLASSES : ""}`}>
			<div className={HEADER_CLASSES}>
				<img src={faviconUrl} alt="" width="28" height="28" />
				<h1 className={TITLE_CLASSES}>Klovi</h1>
				{versionInfo ? (
					<span className={VERSION_CLASSES}>
						{versionInfo.version}
						{versionInfo.commit ? ` (${versionInfo.commit})` : ""}
					</span>
				) : null}
				{onSearchClick ? (
					<SidebarButton onClick={onSearchClick} title={`Search sessions (${formatShortcut("Mod", "K")})`}>
						Search
					</SidebarButton>
				) : null}
				{onSettingsClick ? (
					<SidebarButton onClick={onSettingsClick} title={`Settings (${formatShortcut("Mod", ",")})`}>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							role="img"
							aria-label="Settings"
						>
							<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					</SidebarButton>
				) : null}
			</div>
			<div className={CONTENT_CLASSES}>{children}</div>
			<div className={FOOTER_CLASSES}>
				Made by{" "}
				<a href="https://cookielab.io?utm_source=opensource&utm_medium=klovi" onClick={handleCookielabClick}>
					cookielab.io
				</a>
			</div>
		</div>
	);
}
