import { makeRpcRouter } from "@cookielab.io/klovi-server/effect/http-app";
import { HttpServer } from "@effect/platform";
import { Effect } from "effect";
import { makeStaticHandler } from "./static-handler.ts";

export const makePackageHttpApp = (staticDir: string) => {
  const router = makeRpcRouter();
  return router.pipe(Effect.catchTag("RouteNotFound", () => makeStaticHandler(staticDir)));
};

export const makePackageServeLayer = (staticDir: string) =>
  makePackageHttpApp(staticDir).pipe(HttpServer.serve());
