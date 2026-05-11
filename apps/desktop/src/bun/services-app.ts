import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context } from "effect";

export class VersionState extends Context.Tag("@klovi/desktop/VersionState")<
	VersionState,
	{ readonly info: VersionInfo }
>() {}

export class SettingsPathRef extends Context.Tag("@klovi/desktop/SettingsPathRef")<
	SettingsPathRef,
	{ readonly path: string }
>() {}
