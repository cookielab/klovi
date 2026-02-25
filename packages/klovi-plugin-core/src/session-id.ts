const SESSION_ID_SEPARATOR = "::";

export interface ParsedSessionId<TPluginId extends string = string> {
  pluginId: TPluginId | null;
  rawSessionId: string;
}

export function encodeSessionId(pluginId: string, rawSessionId: string): string {
  return `${pluginId}${SESSION_ID_SEPARATOR}${rawSessionId}`;
}

export function parseSessionId<TPluginId extends string = string>(
  sessionId: string,
): ParsedSessionId<TPluginId> {
  const separatorIdx = sessionId.indexOf(SESSION_ID_SEPARATOR);
  if (separatorIdx === -1) {
    return { pluginId: null, rawSessionId: sessionId };
  }

  return {
    pluginId: sessionId.slice(0, separatorIdx) as TPluginId,
    rawSessionId: sessionId.slice(separatorIdx + SESSION_ID_SEPARATOR.length),
  };
}
