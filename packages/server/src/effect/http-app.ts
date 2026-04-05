import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { RPCError } from "../rpc-error.ts";
import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "../services/errors.ts";
import { KloviServices, type KloviServicesShape } from "./server-services.ts";

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
		return { status: 400, message: "Invalid sessionId format" };
	}
	if (err instanceof ProjectNotFoundError) {
		return { status: 404, message: "Project not found" };
	}
	if (err instanceof PluginSourceNotFoundError) {
		return { status: 404, message: "Plugin source not found" };
	}
	if (err instanceof UnknownPluginError) {
		return { status: 400, message: `Unknown plugin: ${err.pluginId}` };
	}
	if (err instanceof SubAgentNotSupportedError) {
		return { status: 400, message: `Sub-agent sessions are not supported by plugin: ${err.pluginId}` };
	}
	if (err instanceof SettingsWriteError) {
		return { status: 500, message: "Failed to write settings" };
	}
	if (err instanceof RPCError) {
		return { status: err.status, message: err.message };
	}
	const message = err instanceof Error ? err.message : "Internal server error";
	return { status: 500, message: message };
}

const rpcHandler = Effect.gen(function* () {
	const services = yield* KloviServices;
	const routeParams = yield* HttpRouter.params;
	const req = yield* HttpServerRequest.HttpServerRequest;

	const method = routeParams["method"];
	if (!method) {
		return HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 });
	}

	if (!isRpcMethod(method, services)) {
		return yield* Effect.fail(new RPCError(404, `Unknown method: ${method}`));
	}

	let params: Record<string, unknown> = {};
	const bodyText = yield* req.text;
	if (bodyText) {
		try {
			params = JSON.parse(bodyText) as Record<string, unknown>;
		} catch {
			return HttpServerResponse.unsafeJson({ error: "Invalid JSON body" }, { status: 400 });
		}
	}

	const handler = services[method] as (args: Record<string, unknown>) => unknown;
	const result = handler(params);
	if (Effect.isEffect(result)) {
		const value = yield* result as Effect.Effect<unknown, unknown, never>;
		return HttpServerResponse.unsafeJson(value);
	}
	return HttpServerResponse.unsafeJson(result);
}).pipe(
	Effect.catchAll((err) => {
		const { status, message } = mapDomainErrorToStatus(err);
		return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status: status }));
	}),
);

const emptyMethodHandler = Effect.succeed(
	HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 }),
);

const makeRpcRouter = () =>
	HttpRouter.empty.pipe(
		HttpRouter.post("/api/rpc/", emptyMethodHandler),
		HttpRouter.post("/api/rpc/:method", rpcHandler),
	);

const notFoundHandler = Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 }));

const makeHttpApp = () => makeRpcRouter().pipe(Effect.catchTag("RouteNotFound", () => notFoundHandler));

const makeServeLayer = () => makeHttpApp().pipe(HttpServer.serve());

export { makeHttpApp, makeRpcRouter, makeServeLayer };
