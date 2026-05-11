export function formatDiff(oldString: string, newString: string): string {
	const lines: string[] = [];

	if (oldString !== "") {
		for (const line of oldString.split("\n")) {
			lines.push(`-${line}`);
		}
	}
	if (newString !== "") {
		for (const line of newString.split("\n")) {
			lines.push(`+${line}`);
		}
	}

	return lines.join("\n");
}
