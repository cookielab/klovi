import { makeHttpApp, makeRpcRouter } from "@cookielab.io/klovi-server/effect/http-app";
import { HttpServer } from "@effect/platform";
import { Effect } from "effect";
import { makeStaticHandler } from "./static-handler";

export const makePackageHttpApp = (staticDir: string) => {
	const router = makeRpcRouter();
	return router.pipe(Effect.catchTag("RouteNotFound", () => makeStaticHandler(staticDir)));
};

export const makePackageServeLayer = (staticDir: string | undefined) => {
	if (!staticDir) {
		return makeHttpApp().pipe(HttpServer.serve());
	}
	return makePackageHttpApp(staticDir).pipe(HttpServer.serve());
};
