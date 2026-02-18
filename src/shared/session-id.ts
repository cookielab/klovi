const SESSION_ID_SEPARATOR = "::";

export interface ParsedSessionId {
  pluginId: string | null;
  rawSessionId: string;
}

export function encodeSessionId(pluginId: string, rawSessionId: string): string {
  return `${pluginId}${SESSION_ID_SEPARATOR}${rawSessionId}`;
}

export function parseSessionId(sessionId: string): ParsedSessionId {
  const separatorIdx = sessionId.indexOf(SESSION_ID_SEPARATOR);
  if (separatorIdx === -1) {
    return { pluginId: null, rawSessionId: sessionId };
  }
  return {
    pluginId: sessionId.slice(0, separatorIdx),
    rawSessionId: sessionId.slice(separatorIdx + SESSION_ID_SEPARATOR.length),
  };
}
