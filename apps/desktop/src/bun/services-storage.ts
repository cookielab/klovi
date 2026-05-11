import { Context } from "effect";

export class AppDataDirRef extends Context.Tag("@klovi/desktop/AppDataDirRef")<
	AppDataDirRef,
	{ readonly path: string }
>() {}

export class PlatformInfo extends Context.Tag("@klovi/desktop/PlatformInfo")<
	PlatformInfo,
	{ readonly isLinux: boolean }
>() {}
