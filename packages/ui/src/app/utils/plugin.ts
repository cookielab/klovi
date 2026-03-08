import { BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES } from "@cookielab.io/klovi-plugin-core";

export function pluginDisplayName(pluginId: string): string {
  return (
    BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES[
      pluginId as keyof typeof BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES
    ] ?? pluginId
  );
}
