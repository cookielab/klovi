import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { RPCError } from "../rpc-error.ts";
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
	return yield* Effect.tryPromise({
		try: async () => {
			const result = await Promise.resolve(handler(params));
			return HttpServerResponse.unsafeJson(result);
		},
		catch: (err) => err,
	});
}).pipe(
	Effect.catchAll((err) => {
		if (err instanceof RPCError) {
			return Effect.succeed(HttpServerResponse.unsafeJson({ error: err.message }, { status: err.status }));
		}
		const message = err instanceof Error ? err.message : "Internal server error";
		return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status: 500 }));
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
