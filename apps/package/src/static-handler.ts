import { HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";


const N_404 = 404;

const notFound = HttpServerResponse.unsafeJson({ error: "Not found" }, { status: N_404 });

/**
 * A request is a page navigation (SPA route) when its last path segment has no
 * file extension — e.g. `/`, `/projects`, `/projects/42`. Anything with an
 * extension (`.css`, `.js`, `.png`, hashed asset chunks) is a specific static
 * asset and must NOT fall back to index.html: browsers will silently reject an
 * HTML response served with `Content-Type: text/html` for a `<link rel="stylesheet">`
 * or `<script type="module">`, producing broken styling / non-functional JS
 * (e.g. when a cached index.html references stale hashed chunk filenames).
 */
const isNavigationRequest = (pathname: string): boolean => {
	const lastSegment = pathname.split("/").pop() ?? "";
	return !lastSegment.includes(".");
};

export const makeStaticHandler = (staticDir: string) =>
	Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const url = new URL(req.url, "http://localhost");
		const filePath = url.pathname === "/" ? "/index.html" : url.pathname;

		return yield* HttpServerResponse.file(`${staticDir}${filePath}`).pipe(
			Effect.orElse(() =>
				isNavigationRequest(url.pathname)
					? HttpServerResponse.file(`${staticDir}/index.html`).pipe(Effect.orElse(() => Effect.succeed(notFound)))
					: Effect.succeed(notFound),
			),
		);
	});
