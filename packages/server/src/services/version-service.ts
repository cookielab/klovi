type VersionInfo = {
	version: string;
	commit: string;
};

type VersionState = {
	version: string;
	commit: string;
};

function makeVersionState(version: string, commit: string): VersionState {
	const normalizedVersion = version == null || version === "0.0.0" ? "dev" : version;
	return { version: normalizedVersion, commit: commit ?? "" };
}

function getVersion(state: VersionState): VersionInfo {
	return { version: state.version, commit: state.commit };
}

export type { VersionInfo, VersionState };
export { getVersion, makeVersionState };
