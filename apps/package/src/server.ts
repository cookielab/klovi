import { execFile } from "node:child_process";
import { bootstrapServer } from "@cookielab.io/klovi-server/effect/bootstrap";
import { makePackageServeLayer } from "./http-app.ts";

export type { KloviServer, StartKloviServerOptions } from "@cookielab.io/klovi-server/server";
// Re-export startKloviServer as the canonical public npm contract
export { startKloviServer } from "@cookielab.io/klovi-server/server";

export type StartKloviPackageServerOptions = {
	host?: string;
	port?: number;
	staticDir?: string | undefined;
	openBrowser?: boolean;
	version?: string;
	commit?: string;
	settingsPath?: string;
	runtime?: "auto" | "bun" | "node";
};

export type KloviPackageServer = {
	url: string;
	stop: () => void;
};

function openInBrowser(url: string): void {
	const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
	const args = process.platform === "win32" ? ["/c", "start", url] : [url];
	execFile(cmd, args, () => {});
}

/**
 * Internal package composition server that adds static file serving and
 * browser launch on top of the core Klovi server. Not part of the public
 * npm contract — use `startKloviServer` from `@cookielab.io/klovi/server`.
 */
export async function startKloviPackageServer(
	options: StartKloviPackageServerOptions = {},
): Promise<KloviPackageServer> {
	const makeServe = () => makePackageServeLayer(options.staticDir);
	const result = await bootstrapServer(options, makeServe);

	if (options.openBrowser) {
		openInBrowser(result.url);
	}

	return result;
}
