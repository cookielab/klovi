import { Context } from "effect";

export type ServerConfigShape = {
	readonly host: string;
	readonly port: number;
	readonly settingsPath: string;
	readonly version: string;
	readonly commit: string;
};

export class ServerConfig extends Context.Tag("@klovi/ServerConfig")<ServerConfig, ServerConfigShape>() {}
