import { appVersion } from "../version.ts";

export function handleVersion(): Response {
  return Response.json(appVersion);
}
