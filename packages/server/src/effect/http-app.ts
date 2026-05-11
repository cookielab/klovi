import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { RpcError } from "../rpc-error";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "../services/errors";
import { KloviServices, type KloviServicesShape } from "./server-services";

const N_400 = 400;
const N_404 = 404;
const N_500 = 500;

/** Methods on KloviServices that are callable via RPC (excludes internal fields). */
type RpcMethodName = {
	[K in keyof KloviServicesShape]: KloviServicesShape[K] extends (...args: never[]) => unknown ? K : never;
}[keyof KloviServicesShape];

/**
 * Fields on KloviServicesShape that are NOT callable RPC methods.
 * IMPORTANT: If you add a non-callable field to KloviServicesShape, add it here too.
 */
const NON_RPC_KEYS: ReadonlySet<string> = new Set(["getRegistry", "settingsPath"]);

function isRpcMethod(method: string, services: KloviServicesShape): method is RpcMethodName {
	return Object.hasOwn(services, method) && !NON_RPC_KEYS.has(method);
}

function mapDomainErrorToStatus(err: unknown): { status: number; message: string } {
	if (err instanceof InvalidSessionIdError) {
		return { status: N_400, message: "Invalid sessionId format" };
	}
	if (err instanceof ProjectNotFoundError) {
		return { status: N_404, message: "Project not found" };
	}
	if (err instanceof PluginSourceNotFoundError) {
		return { status: N_404, message: "Plugin source not found" };
	}
	if (err instanceof UnknownPluginError) {
		return { status: N_400, message: `Unknown plugin: ${err.pluginId}` };
	}
	if (err instanceof SubAgentNotSupportedError) {
		return { status: N_400, message: `Sub-agent sessions are not supported by plugin: ${err.pluginId}` };
	}
	if (err instanceof SettingsWriteError) {
		return { status: N_500, message: "Failed to write settings" };
	}
	if (err instanceof RpcError) {
		return { status: err.status, message: err.message };
	}
	const message = err instanceof Error ? err.message : "Internal server error";
	return { status: N_500, message: message };
}

const rpcHandler = Effect.gen(function* () {
	const services = yield* KloviServices;
	const routeParams = yield* HttpRouter.params;
	const req = yield* HttpServerRequest.HttpServerRequest;

	const method = routeParams["method"];
	if (!method) {
		return HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: N_400 });
	}

	if (!isRpcMethod(method, services)) {
		const httpNotFound = N_404;
		return yield* Effect.fail(new RpcError(httpNotFound, `Unknown method: ${method}`));
	}

	let params: Record<string, unknown> = {};
	const bodyText = yield* req.text;
	if (bodyText) {
		try {
			params = JSON.parse(bodyText) as Record<string, unknown>;
		} catch {
			return HttpServerResponse.unsafeJson({ error: "Invalid JSON body" }, { status: N_400 });
		}
	}

	const handler = services[method] as (args: Record<string, unknown>) => Effect.Effect<unknown, unknown, never>;
	const value = yield* handler(params);
	return HttpServerResponse.unsafeJson(value);
}).pipe(
	Effect.catchAll((err) => {
		const { status, message } = mapDomainErrorToStatus(err);
		return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status: status }));
	}),
);

const emptyMethodHandler = Effect.succeed(
	HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: N_400 }),
);

const rpcRouter = HttpRouter.empty.pipe(
	HttpRouter.post("/api/rpc/", emptyMethodHandler),
	HttpRouter.post("/api/rpc/:method", rpcHandler),
);

function makeRpcRouter(): typeof rpcRouter {
	return rpcRouter;
}

const notFoundHandler = Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: N_404 }));

const httpApp = rpcRouter.pipe(Effect.catchTag("RouteNotFound", () => notFoundHandler));

function makeHttpApp(): typeof httpApp {
	return httpApp;
}

const serveLayer = httpApp.pipe(HttpServer.serve());

function makeServeLayer(): typeof serveLayer {
	return serveLayer;
}

export { makeHttpApp, makeRpcRouter, makeServeLayer };
