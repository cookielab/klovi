import { join } from "node:path";
import { HttpServer } from "@effect/platform";
import { Cause, Effect, Fiber, Layer } from "effect";
import { makeBunServerLayer } from "./platform-bun.ts";
import { setPluginLayer } from "./plugin-runtime.ts";
import { ServerConfig } from "./server-config.ts";
import { KloviServicesLive } from "./server-services.ts";

export type BootstrapOptions = {
	host?: string;
	port?: number;
	version?: string;
	commit?: string;
	settingsPath?: string;
	runtime?: "auto" | "bun" | "node";
};

export type BootstrapResult = {
	url: string;
	stop: () => void;
};

function getDefaultSettingsPath(): string {
	const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
	return join(home, ".klovi", "settings.json");
}

function detectRuntime(requested: "auto" | "bun" | "node" = "auto"): "bun" | "node" {
	if (requested !== "auto") {
		return requested;
	}
	return typeof globalThis.Bun === "undefined" ? "node" : "bun";
}

/**
 * Shared server bootstrap logic used by both `packages/server` and `apps/package`.
 *
 * Accepts a function that produces the serve layer to run. This allows
 * `packages/server` to pass the RPC-only serve layer while `apps/package`
 * can compose RPC + static file serving.
 */
export async function bootstrapServer(
	options: BootstrapOptions,
	makeServe: () => Layer.Layer<
		never,
		never,
		// biome-ignore lint/suspicious/noExplicitAny: Layer output varies by caller
		any
	>,
): Promise<BootstrapResult> {
	const host = options.host ?? "127.0.0.1";
	const port = options.port ?? 0;
	const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
	const version = options.version ?? "dev";
	const commit = options.commit ?? "";
	const rt = detectRuntime(options.runtime);

	// Configure plugin layer and platform layer for the selected runtime
	// biome-ignore lint/suspicious/noExplicitAny: platform layers have different type signatures
	let platformLayer: Layer.Layer<any, any, any>;
	if (rt === "node") {
		const { NodePluginLayer, makeNodeServerLayer } = await import("./platform-node.ts");
		setPluginLayer(NodePluginLayer);
		platformLayer = makeNodeServerLayer({ host: host, port: port });
	} else {
		platformLayer = makeBunServerLayer({ hostname: host, port: port });
	}

	const configLayer = Layer.succeed(ServerConfig, {
		host: host,
		port: port,
		settingsPath: settingsPath,
		version: version,
		commit: commit,
	});

	const servicesLayer = KloviServicesLive.pipe(Layer.provide(configLayer));

	let resolveAddress!: (url: string) => void;
	let rejectAddress!: (err: unknown) => void;
	const addressPromise = new Promise<string>((resolve, reject) => {
		resolveAddress = resolve;
		rejectAddress = reject;
	});

	const addressCapture = Layer.effectDiscard(
		HttpServer.addressWith((address) =>
			Effect.gen(function* () {
				const addr = address as HttpServer.TcpAddress;
				const url = `http://${addr.hostname}:${addr.port}`;
				yield* Effect.log(`Klovi server listening on ${url}`);
				resolveAddress(url);
			}),
		),
	);

	const serveLayer = makeServe();
	const fullLayer = (Layer.merge(serveLayer, addressCapture) as Layer.Layer<never, never, never>).pipe(
		Layer.provide(servicesLayer),
		Layer.provide(configLayer),
		Layer.provide(platformLayer),
	);

	const fiber = Effect.runFork(Layer.launch(fullLayer as Layer.Layer<never, never, never>));

	// Surface fiber failures instead of hanging silently
	Effect.runFork(
		Fiber.join(fiber).pipe(Effect.catchAllCause((cause) => Effect.sync(() => rejectAddress(Cause.squash(cause))))),
	);

	const url = await addressPromise;

	return {
		url: url,
		stop: () => {
			Effect.runFork(Fiber.interrupt(fiber));
		},
	};
}
