import type React from "react";

type SidebarProps = {
	header?: React.ReactNode;
	footer?: React.ReactNode;
	children: React.ReactNode;
};

export function Sidebar({ header, footer, children }: SidebarProps) {
	return (
		<div className="fixed top-0 left-0 z-10 flex h-screen w-sidebar flex-col overflow-hidden border-border border-r bg-surface-muted transition-transform duration-200 ease-[ease] group-data-[hide-sidebar=true]:-translate-x-full">
			{header ? (
				<div className="flex h-header flex-shrink-0 items-center gap-3 border-border border-b px-4">{header}</div>
			) : null}
			<div className="flex-1 overflow-y-auto p-2">{children}</div>
			{footer ? (
				<div className="flex-shrink-0 border-border-muted border-t px-4 py-2.5 text-center text-[0.7rem] text-foreground-subtle">
					{footer}
				</div>
			) : null}
		</div>
	);
}
