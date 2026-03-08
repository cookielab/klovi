import { HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";

export const makeStaticHandler = (staticDir: string) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(req.url, "http://localhost");
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;

    return yield* HttpServerResponse.file(`${staticDir}${filePath}`).pipe(
      Effect.orElse(() => HttpServerResponse.file(`${staticDir}/index.html`)),
      Effect.orElse(() =>
        Effect.succeed(HttpServerResponse.unsafeJson({ error: "Not found" }, { status: 404 })),
      ),
    );
  });
