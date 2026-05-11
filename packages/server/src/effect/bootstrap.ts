import { join } from "node:path";
import { HttpServer } from "@effect/platform";
import { Cause, Effect, Fiber, Layer } from "effect";
import { makeBunServerLayer } from "./platform-bun";
import { ServerConfig } from "./server-config";
import { KloviServicesLive } from "./server-services";

type BootstrapOptions = {
	host?: string;
	port?: number;
	version?: string;
	commit?: string;
	settingsPath?: string;
	runtime?: "auto" | "bun" | "node";
};

type BootstrapResult = {
	url: string;
	stop: () => void;
};

function getDefaultSettingsPath(): string {
	const home = Bun.env["HOME"] ?? Bun.env["USERPROFILE"] ?? "";
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
type AnyLayer = Layer.Layer<never, unknown, unknown>;

async function bootstrapServer(options: BootstrapOptions, makeServe: () => AnyLayer): Promise<BootstrapResult> {
	const host = options.host ?? "127.0.0.1";
	const port = options.port ?? 0;
	const settingsPath = options.settingsPath ?? getDefaultSettingsPath();
	const version = options.version ?? "dev";
	const commit = options.commit ?? "";
	const rt = detectRuntime(options.runtime);

	// Configure plugin layer and platform layer for the selected runtime
	let platformLayer: AnyLayer;
	if (rt === "node") {
		const { makeNodeServerLayer } = await import("./platform-node");
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

	let resolveAddress!: (addr: string) => void;
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

export type { BootstrapOptions, BootstrapResult };
export { bootstrapServer };
