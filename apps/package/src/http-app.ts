import { makeHttpApp, makeRpcRouter } from "@cookielab.io/klovi-server/effect/http-app";
import type { KloviServices } from "@cookielab.io/klovi-server/effect/server-services";
import { type HttpPlatform, HttpServer, type HttpServerRequest, type HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { makeStaticHandler } from "./static-handler";

type PackageHttpApp = Effect.Effect<
	HttpServerResponse.HttpServerResponse,
	never,
	HttpPlatform.HttpPlatform | HttpServerRequest.HttpServerRequest | KloviServices
>;
type PackageServeLayer = ReturnType<typeof HttpServer.serve>;

export const makePackageHttpApp = (staticDir: string): PackageHttpApp =>
	makeRpcRouter().pipe(Effect.catchTag("RouteNotFound", () => makeStaticHandler(staticDir)));

export const makePackageServeLayer = (staticDir: string | undefined): PackageServeLayer => {
	if (!staticDir) {
		return makeHttpApp().pipe(HttpServer.serve());
	}
	return makePackageHttpApp(staticDir).pipe(HttpServer.serve());
};
