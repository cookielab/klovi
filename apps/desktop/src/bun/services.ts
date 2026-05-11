import type { SettingsPathRef, VersionState } from "./services-app";
import type { RegistryRef } from "./services-registry";
import type { AppDataDirRef, PlatformInfo } from "./services-storage";
import type { UpdaterConfig, UpdateStatusRef } from "./services-updater";

export { SettingsPathRef, VersionState } from "./services-app";
export { RegistryRef } from "./services-registry";
export { AppDataDirRef, PlatformInfo } from "./services-storage";
export { UpdaterConfig, UpdateStatusRef } from "./services-updater";

export type DesktopServices =
	| VersionState
	| SettingsPathRef
	| AppDataDirRef
	| PlatformInfo
	| RegistryRef
	| UpdateStatusRef
	| UpdaterConfig;
