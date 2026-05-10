import type { ThemeSetting } from "@cookielab.io/klovi-design-system";
import { useCallback, useEffect, useState } from "react";
import { useKloviHostBridge, useRunKloviEffect } from "../../lib/context";
import { kloviHostBridge } from "../../lib/rpc-client";


const N_10 = 10;

const DEFAULT_PRESENTATION_FONT_SIZE = 15;
const PRESENTATION_FONT_SIZE_STEP = 2;
const MAX_PRESENTATION_FONT_SIZE = 28;
const MIN_PRESENTATION_FONT_SIZE = 10;

export type { ThemeSetting, UseThemeOptions } from "@cookielab.io/klovi-design-system";
// Re-export core theme hooks from DS
export { resolveTheme, useFontSize, useTheme } from "@cookielab.io/klovi-design-system";

export function useSystemThemeOverride(): "dark" | "light" | null {
	const hostBridge = useKloviHostBridge();
	const runKloviEffect = useRunKloviEffect();
	const [theme, setTheme] = useState<"dark" | "light" | null>(null);

	useEffect(() => {
		runKloviEffect(kloviHostBridge.getSystemTheme())
			.then((result) => setTheme(result.theme))
			.catch(() => undefined);
	}, [runKloviEffect]);

	useEffect(
		() =>
			hostBridge.onSystemThemeChange((newTheme) => {
				setTheme(newTheme);
			}),
		[hostBridge],
	);

	return theme;
}

export function usePresentationTheme() {
	const [setting, setSetting] = useState<ThemeSetting>(() => {
		const stored = localStorage.getItem("klovi-presentation-theme");
		if (stored === "light" || stored === "dark") {
			return stored;
		}
		return "system";
	});

	const [sameAsGlobal, setSameAsGlobalState] = useState(
		() => localStorage.getItem("klovi-presentation-same-theme") !== "false",
	);

	useEffect(() => {
		localStorage.setItem("klovi-presentation-theme", setting);
	}, [setting]);

	useEffect(() => {
		localStorage.setItem("klovi-presentation-same-theme", String(sameAsGlobal));
	}, [sameAsGlobal]);

	const set = useCallback((theme: ThemeSetting) => {
		setSetting(theme);
	}, []);

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

	const setSameAsGlobal = useCallback((v: boolean) => {
		setSameAsGlobalState(v);
	}, []);

	return { setting: setting, sameAsGlobal: sameAsGlobal, setSameAsGlobal: setSameAsGlobal, set: set, cycle: cycle };
}

export function usePresentationFontSize() {
	const [size, setSize] = useState(() => {
		const stored = localStorage.getItem("klovi-presentation-font-size");
		return stored ? Number.parseInt(stored, N_10) : DEFAULT_PRESENTATION_FONT_SIZE;
	});

	const [sameAsGlobal, setSameAsGlobalState] = useState(
		() => localStorage.getItem("klovi-presentation-same-font-size") !== "false",
	);

	useEffect(() => {
		localStorage.setItem("klovi-presentation-font-size", String(size));
	}, [size]);

	useEffect(() => {
		localStorage.setItem("klovi-presentation-same-font-size", String(sameAsGlobal));
	}, [sameAsGlobal]);

	const increase = useCallback(
		() => setSize((s) => Math.min(s + PRESENTATION_FONT_SIZE_STEP, MAX_PRESENTATION_FONT_SIZE)),
		[],
	);
	const decrease = useCallback(
		() => setSize((s) => Math.max(s - PRESENTATION_FONT_SIZE_STEP, MIN_PRESENTATION_FONT_SIZE)),
		[],
	);
	const set = useCallback(
		(s: number) => setSize(Math.max(MIN_PRESENTATION_FONT_SIZE, Math.min(MAX_PRESENTATION_FONT_SIZE, s))),
		[],
	);

	const setSameAsGlobal = useCallback((v: boolean) => {
		setSameAsGlobalState(v);
	}, []);

	return {
		size: size,
		sameAsGlobal: sameAsGlobal,
		setSameAsGlobal: setSameAsGlobal,
		set: set,
		increase: increase,
		decrease: decrease,
	};
}
