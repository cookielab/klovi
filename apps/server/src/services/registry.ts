import {
  PluginRegistry as CorePluginRegistryImpl,
  type SessionIdEncoder as CoreSessionIdEncoder,
  encodeResolvedPath,
} from "@cookielab.io/klovi-plugin-core";
import type { Session, SessionSummary } from "@cookielab.io/klovi-ui/types";

export { encodeResolvedPath };

export type SessionIdEncoder = CoreSessionIdEncoder<string>;

export class PluginRegistry extends CorePluginRegistryImpl<string, SessionSummary, Session> {}
