import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

export function useSearchShortcut({
	fetchSearchSessions,
	setSearchOpen,
}: {
	fetchSearchSessions: () => void;
	setSearchOpen: Dispatch<SetStateAction<boolean>>;
}): void {
	useEffect(() => {
		function handleCmdK(e: KeyboardEvent): void {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setSearchOpen((prev) => {
					if (!prev) {
						fetchSearchSessions();
					}
					return !prev;
				});
			}
		}
		globalThis.addEventListener("keydown", handleCmdK);
		return () => globalThis.removeEventListener("keydown", handleCmdK);
	}, [fetchSearchSessions, setSearchOpen]);
}

export function useGlobalShortcuts({
	canPresent,
	togglePresentation,
	increase,
	decrease,
}: {
	canPresent: boolean;
	togglePresentation: () => void;
	increase: () => void;
	decrease: () => void;
}): void {
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent): void {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}
			if (e.ctrlKey || e.metaKey || e.altKey) {
				return;
			}

			switch (e.key) {
				case "p":
					if (canPresent) {
						e.preventDefault();
						togglePresentation();
					}
					break;
				case "+":
				case "=":
					e.preventDefault();
					increase();
					break;
				case "-":
					e.preventDefault();
					decrease();
					break;
				default:
					break;
			}
		}

		globalThis.addEventListener("keydown", handleKeyDown);
		return () => globalThis.removeEventListener("keydown", handleKeyDown);
	}, [canPresent, togglePresentation, increase, decrease]);
}

export function useSettingsShortcut({
	isSettings,
	closeSettings,
	goSettings,
}: {
	isSettings: boolean;
	closeSettings: () => void;
	goSettings: () => void;
}): void {
	useEffect(() => {
		function handleCmdComma(e: KeyboardEvent): void {
			if ((e.metaKey || e.ctrlKey) && e.key === ",") {
				e.preventDefault();
				if (isSettings) {
					closeSettings();
				} else {
					goSettings();
				}
			}
		}
		globalThis.addEventListener("keydown", handleCmdComma);
		return () => globalThis.removeEventListener("keydown", handleCmdComma);
	}, [isSettings, goSettings, closeSettings]);
}
