import {
	PluginRegistry as CorePluginRegistryImpl,
	type SessionIdEncoder as CoreSessionIdEncoder,
	encodeResolvedPath,
	type Session,
	type SessionSummary,
} from "@cookielab.io/klovi-plugin-core";

export { encodeResolvedPath };

export type SessionIdEncoder = CoreSessionIdEncoder<string>;

export class PluginRegistry extends CorePluginRegistryImpl<string, SessionSummary, Session> {}
