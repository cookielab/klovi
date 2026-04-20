export function tryParseJson<T>(value: string): T | undefined {
	try {
		return JSON.parse(value) as T;
	} catch {
		// biome-ignore lint/complexity/noUselessUndefined: explicit return needed for TypeScript
		return undefined;
	}
}
