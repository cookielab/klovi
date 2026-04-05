import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context, type Ref } from "effect";

export class VersionState extends Context.Tag("@klovi/desktop/VersionState")<
	VersionState,
	{ readonly info: VersionInfo }
>() {}

export class SettingsPathRef extends Context.Tag("@klovi/desktop/SettingsPathRef")<
	SettingsPathRef,
	{ readonly path: string }
>() {}

export class AppDataDirRef extends Context.Tag("@klovi/desktop/AppDataDirRef")<
	AppDataDirRef,
	{ readonly path: string }
>() {}

export class PlatformInfo extends Context.Tag("@klovi/desktop/PlatformInfo")<
	PlatformInfo,
	{ readonly isLinux: boolean }
>() {}

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<RegistryRef, Ref.Ref<PluginRegistry>>() {}

export type DesktopServices = VersionState | SettingsPathRef | AppDataDirRef | PlatformInfo | RegistryRef;
