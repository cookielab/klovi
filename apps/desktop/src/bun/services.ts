import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import type { VersionInfo } from "@cookielab.io/klovi-server/services/version-service";
import { Context, type Ref, type SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types.ts";

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

export class VersionState extends Context.Tag("@klovi/desktop/VersionState")<
	VersionState,
	{ readonly info: VersionInfo }
>() {}

export class SettingsPathRef extends Context.Tag("@klovi/desktop/SettingsPathRef")<
	SettingsPathRef,
	{ readonly path: string }
>() {}

// biome-ignore lint/security/noSecrets: not a real secret
export class AppDataDirRef extends Context.Tag("@klovi/desktop/AppDataDirRef")<
	AppDataDirRef,
	{ readonly path: string }
>() {}

export class PlatformInfo extends Context.Tag("@klovi/desktop/PlatformInfo")<
	PlatformInfo,
	{ readonly isLinux: boolean }
>() {}

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<RegistryRef, Ref.Ref<PluginRegistry>>() {}

export class UpdateStatusRef extends Context.Tag("@klovi/desktop/UpdateStatusRef")<
	UpdateStatusRef,
	SubscriptionRef.SubscriptionRef<UpdateStatus>
>() {}

export class UpdaterConfig extends Context.Tag("@klovi/desktop/UpdaterConfig")<
	UpdaterConfig,
	{
		readonly currentVersion: string;
		readonly platform: Platform;
		readonly arch: Arch;
	}
>() {}

export type DesktopServices =
	| VersionState
	| SettingsPathRef
	| AppDataDirRef
	| PlatformInfo
	| RegistryRef
	| UpdateStatusRef
	| UpdaterConfig;
