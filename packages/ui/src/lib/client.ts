import type { DesktopClientRequestMap, DesktopRequestArgs } from "../shared/desktop-contract.ts";

export type KloviClient = {
	[K in keyof DesktopClientRequestMap]: (
		...args: DesktopRequestArgs<DesktopClientRequestMap[K]>
	) => Promise<DesktopClientRequestMap[K]["response"]>;
};
