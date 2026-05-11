import { Context, type SubscriptionRef } from "effect";
import type { UpdateStatus } from "../shared/rpc-types";

type Platform = "macos" | "linux" | "win";
type Arch = "arm64" | "x64";

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
