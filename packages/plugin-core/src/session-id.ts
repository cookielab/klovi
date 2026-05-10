const SESSION_ID_SEPARATOR = "::";

export type ParsedSessionId<TpluginId extends string = string> = {
	pluginId: TpluginId | null;
	rawSessionId: string;
};

export function encodeSessionId(pluginId: string, rawSessionId: string): string {
	return `${pluginId}${SESSION_ID_SEPARATOR}${rawSessionId}`;
}

export function parseSessionId<TpluginId extends string = string>(sessionId: string): ParsedSessionId<TpluginId> {
	const separatorIdx = sessionId.indexOf(SESSION_ID_SEPARATOR);
	if (separatorIdx === -1) {
		return { pluginId: null, rawSessionId: sessionId };
	}

	return {
		pluginId: sessionId.slice(0, separatorIdx) as TpluginId,
		rawSessionId: sessionId.slice(separatorIdx + SESSION_ID_SEPARATOR.length),
	};
}
