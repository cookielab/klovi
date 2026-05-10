import {
	InvalidSessionIdError,
	PluginSourceNotFoundError,
	ProjectNotFoundError,
	SettingsWriteError,
	SubAgentNotSupportedError,
	UnknownPluginError,
} from "./errors";

describe("domain errors", () => {
	it("ProjectNotFoundError carries encodedPath", () => {
		const err = new ProjectNotFoundError({ encodedPath: "-Users-foo" });
		expect(err._tag).toBe("ProjectNotFoundError");
		expect(err.encodedPath).toBe("-Users-foo");
	});

	it("InvalidSessionIdError carries the raw value", () => {
		const err = new InvalidSessionIdError({ value: "bad" });
		expect(err._tag).toBe("InvalidSessionIdError");
		expect(err.value).toBe("bad");
	});

	it("PluginSourceNotFoundError carries plugin id and project", () => {
		const err = new PluginSourceNotFoundError({ pluginId: "p", project: "x" });
		expect(err._tag).toBe("PluginSourceNotFoundError");
		expect(err.pluginId).toBe("p");
		expect(err.project).toBe("x");
	});

	it("UnknownPluginError carries plugin id", () => {
		const err = new UnknownPluginError({ pluginId: "nope" });
		expect(err._tag).toBe("UnknownPluginError");
		expect(err.pluginId).toBe("nope");
	});

	it("SubAgentNotSupportedError carries plugin id", () => {
		const err = new SubAgentNotSupportedError({ pluginId: "p" });
		expect(err._tag).toBe("SubAgentNotSupportedError");
		expect(err.pluginId).toBe("p");
	});

	it("SettingsWriteError carries path and cause", () => {
		const cause = new Error("EACCES");
		const err = new SettingsWriteError({ path: "/tmp/s.json", cause: cause });
		expect(err._tag).toBe("SettingsWriteError");
		expect(err.path).toBe("/tmp/s.json");
		expect(err.cause).toBe(cause);
	});
});
