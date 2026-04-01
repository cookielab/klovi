import { SidebarButton } from "@cookielab.io/klovi-design-system";
import { formatShortcut } from "@cookielab.io/klovi-ui-components/utilities";
import type React from "react";
import faviconUrl from "../../../../favicon.svg";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context.ts";
import { useRPC } from "../../hooks/useRpc.ts";

type VersionInfo = {
	version: string;
	commit: string;
};

type SidebarProps = {
	children: React.ReactNode;
	onSearchClick?: (() => void) | undefined;
	onSettingsClick?: (() => void) | undefined;
};

export function Sidebar({ children, onSearchClick, onSettingsClick }: SidebarProps) {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const { data: versionInfo } = useRPC<VersionInfo>(() => client.getVersion(), [client]);

	return (
		<div className="sidebar">
			<div className="sidebar-header">
				<img src={faviconUrl} alt="" width="28" height="28" />
				<h1>Klovi</h1>
				{versionInfo && (
					<span className="sidebar-version">
						{versionInfo.version}
						{versionInfo.commit ? ` (${versionInfo.commit})` : ""}
					</span>
				)}
				{onSearchClick && (
					<SidebarButton onClick={onSearchClick} title={`Search sessions (${formatShortcut("Mod", "K")})`}>
						Search
					</SidebarButton>
				)}
				{onSettingsClick && (
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
				)}
			</div>
			<div className="sidebar-content">{children}</div>
			<div className="sidebar-footer">
				Made by{" "}
				<a
					href="https://cookielab.io?utm_source=opensource&utm_medium=klovi"
					onClick={(e) => {
						e.preventDefault();
						void hostBridge.openExternal({
							url: "https://cookielab.io?utm_source=opensource&utm_medium=klovi",
						});
					}}
				>
					cookielab.io
				</a>
			</div>
		</div>
	);
}
