import type React from "react";

type AppLayoutProps = {
	sidebar: React.ReactNode;
	hideSidebar?: boolean;
	children: React.ReactNode;
};

export function AppLayout({ sidebar, hideSidebar, children }: AppLayoutProps): React.ReactNode {
	return (
		<div className="group flex min-h-screen" data-hide-sidebar={hideSidebar ? "true" : undefined}>
			{sidebar}
			<div className="ml-sidebar flex min-h-screen flex-1 flex-col transition-[margin-left] duration-200 ease-[ease] group-data-[hide-sidebar=true]:ml-0">
				{children}
			</div>
		</div>
	);
}
