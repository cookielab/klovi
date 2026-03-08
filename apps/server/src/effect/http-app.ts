import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { handleRPC, RPCError } from "../rpc.ts";
import { KloviServices } from "./server-services.ts";

const rpcHandler = Effect.gen(function* () {
  const services = yield* KloviServices;
  const routeParams = yield* HttpRouter.params;
  const req = yield* HttpServerRequest.HttpServerRequest;

  const method = routeParams["method"];
  if (!method) {
    return HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 });
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

  const versionInfo = services.getVersion();
  const ctx = {
    registry: services.registry,
    settingsPath: services.settingsPath,
    version: versionInfo,
  };
  return yield* Effect.tryPromise({
    try: async () => {
      const result = await Promise.resolve(handleRPC(method, ctx, params));
      return HttpServerResponse.unsafeJson(result);
    },
    catch: (err) => err,
  });
}).pipe(
  Effect.catchAll((err) => {
    if (err instanceof RPCError) {
      return Effect.succeed(
        HttpServerResponse.unsafeJson({ error: err.message }, { status: err.status }),
      );
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return Effect.succeed(HttpServerResponse.unsafeJson({ error: message }, { status: 500 }));
  }),
);

const emptyMethodHandler = Effect.succeed(
  HttpServerResponse.unsafeJson({ error: "Method name required" }, { status: 400 }),
);

export const makeRpcRouter = () =>
  HttpRouter.empty.pipe(
    HttpRouter.post("/api/rpc/", emptyMethodHandler),
    HttpRouter.post("/api/rpc/:method", rpcHandler),
  );

const notFoundHandler = Effect.succeed(
  HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 }),
);

export const makeHttpApp = () =>
  makeRpcRouter().pipe(Effect.catchTag("RouteNotFound", () => notFoundHandler));

export const makeServeLayer = () => makeHttpApp().pipe(HttpServer.serve());
