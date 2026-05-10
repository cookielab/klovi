import type { DesktopClientRequestMap, DesktopRequestArgs } from "../shared/desktop-contract";

export type KloviClient = {
	[K in keyof DesktopClientRequestMap]: (
		...args: DesktopRequestArgs<DesktopClientRequestMap[K]>
	) => Promise<DesktopClientRequestMap[K]["response"]>;
};
