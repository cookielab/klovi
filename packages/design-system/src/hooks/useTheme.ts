import { useCallback, useEffect, useState } from "react";
import type { ResolvedTheme, ThemeSetting } from "../types";

function getSystemTheme(): ResolvedTheme {
	return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(setting: ThemeSetting, systemThemeOverride?: "dark" | "light" | null): ResolvedTheme {
	if (setting === "system") {
		return systemThemeOverride ?? getSystemTheme();
	}
	return setting;
}

export type UseThemeOptions = {
	systemThemeOverride?: "dark" | "light" | null;
};

export function useTheme(options?: UseThemeOptions) {
	const systemThemeOverride = options?.systemThemeOverride ?? null;

	const [setting, setSetting] = useState<ThemeSetting>(() => {
		const stored = localStorage.getItem("klovi-theme");
		if (stored === "light" || stored === "dark") {
			return stored;
		}
		return "system";
	});

	const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(setting, systemThemeOverride));

	// Apply theme to DOM
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", resolved);
	}, [resolved]);

	// Persist setting and resolve theme
	useEffect(() => {
		localStorage.setItem("klovi-theme", setting);
		setResolved(resolveTheme(setting, systemThemeOverride));
	}, [setting, systemThemeOverride]);

	// Listen for system theme changes when in "system" mode (skip when override is active)
	useEffect(() => {
		if (setting !== "system") {
			return;
		}
		if (systemThemeOverride) {
			return;
		}

		const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => setResolved(getSystemTheme());
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [setting, systemThemeOverride]);

	const cycle = useCallback(() => {
		setSetting((s) => {
			if (s === "system") {
				return "light";
			}
			if (s === "light") {
				return "dark";
			}
			return "system";
		});
	}, []);

	const set = useCallback((theme: ThemeSetting) => {
		setSetting(theme);
	}, []);

	return { setting: setting, resolved: resolved, cycle: cycle, set: set };
}
