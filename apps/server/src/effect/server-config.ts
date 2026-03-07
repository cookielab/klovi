import { Context } from "effect";

export interface ServerConfigShape {
  readonly host: string;
  readonly port: number;
  readonly staticDir: string | undefined;
  readonly settingsPath: string;
  readonly version: string;
  readonly commit: string;
}

export class ServerConfig extends Context.Tag("@klovi/ServerConfig")<
  ServerConfig,
  ServerConfigShape
>() {}
