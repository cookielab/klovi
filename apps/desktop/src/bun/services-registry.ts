import type { PluginRegistry } from "@cookielab.io/klovi-server/services/registry";
import { Context, type Ref } from "effect";

export class RegistryRef extends Context.Tag("@klovi/desktop/RegistryRef")<RegistryRef, Ref.Ref<PluginRegistry>>() {}
