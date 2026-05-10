import {
	encodeCursorProjectPath,
	getCursorAppSupportRoot,
	getCursorGlobalDbPath,
	getCursorWorkspaceStorageDir,
	getDefaultCursorDir,
} from "./config";

describe("cursor config", () => {
	it("derives default directories on macOS", () => {
		const windowsHome = ["C:", "Users", "tester"].join("\\");
		const windowsAppData = [windowsHome, "AppData", "Roaming"].join("\\");
		const env = {
			["HOME"]: "/Users/tester",
			["USERPROFILE"]: windowsHome,
			["XDG_CONFIG_HOME"]: "/tmp/xdg",
			["APPDATA"]: windowsAppData,
		};

		expect(getDefaultCursorDir({ platform: "darwin", env: env })).toBe("/Users/tester/.cursor");
		expect(getCursorAppSupportRoot({ platform: "darwin", env: env })).toBe(
			"/Users/tester/Library/Application Support/Cursor",
		);
		expect(getCursorGlobalDbPath({ platform: "darwin", env: env })).toBe(
			"/Users/tester/Library/Application Support/Cursor/User/globalStorage/state.vscdb",
		);
		expect(getCursorWorkspaceStorageDir({ platform: "darwin", env: env })).toBe(
			"/Users/tester/Library/Application Support/Cursor/User/workspaceStorage",
		);
	});

	it("derives default directories on Linux", () => {
		const env = {
			["HOME"]: "/home/tester",
			["XDG_CONFIG_HOME"]: "/home/tester/.config-custom",
		};

		expect(getDefaultCursorDir({ platform: "linux", env: env })).toBe("/home/tester/.cursor");
		expect(getCursorAppSupportRoot({ platform: "linux", env: env })).toBe("/home/tester/.config-custom/Cursor");
		expect(getCursorGlobalDbPath({ platform: "linux", env: env })).toBe(
			"/home/tester/.config-custom/Cursor/User/globalStorage/state.vscdb",
		);
		expect(getCursorWorkspaceStorageDir({ platform: "linux", env: env })).toBe(
			"/home/tester/.config-custom/Cursor/User/workspaceStorage",
		);
	});

	it("derives default directories on Windows", () => {
		const windowsHome = ["C:", "Users", "tester"].join("\\");
		const windowsAppData = [windowsHome, "AppData", "Roaming"].join("\\");
		const env = {
			["USERPROFILE"]: windowsHome,
			["APPDATA"]: windowsAppData,
		};

		expect(getDefaultCursorDir({ platform: "win32", env: env })).toBe([windowsHome, ".cursor"].join("\\"));
		expect(getCursorAppSupportRoot({ platform: "win32", env: env })).toBe([windowsAppData, "Cursor"].join("\\"));
		expect(getCursorGlobalDbPath({ platform: "win32", env: env })).toBe(
			[windowsAppData, "Cursor", "User", "globalStorage", "state.vscdb"].join("\\"),
		);
		expect(getCursorWorkspaceStorageDir({ platform: "win32", env: env })).toBe(
			[windowsAppData, "Cursor", "User", "workspaceStorage"].join("\\"),
		);
	});

	it("encodes project paths for Cursor transcript directories", () => {
		expect(encodeCursorProjectPath("/Users/tester/project")).toBe("Users-tester-project");
		expect(encodeCursorProjectPath("C:\\Users\\tester\\project")).toBe("C--Users-tester-project");
	});
});
