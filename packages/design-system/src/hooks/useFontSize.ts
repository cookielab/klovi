import { useCallback, useEffect, useState } from "react";

const N_10 = 10;

const DEFAULT_FONT_SIZE = 15;
const FONT_SIZE_STEP = 2;
const MAX_FONT_SIZE = 28;
const MIN_FONT_SIZE = 10;

type UseFontSizeResult = {
	size: number;
	increase: () => void;
	decrease: () => void;
	set: (size: number) => void;
};

export function useFontSize(): UseFontSizeResult {
	const [size, setSize] = useState(() => {
		const stored = localStorage.getItem("klovi-font-size");
		return stored ? Number.parseInt(stored, N_10) : DEFAULT_FONT_SIZE;
	});

	useEffect(() => {
		document.documentElement.style.setProperty("--font-size-base", `${size}px`);
		localStorage.setItem("klovi-font-size", String(size));
	}, [size]);

	const increase = useCallback(() => setSize((s) => Math.min(s + FONT_SIZE_STEP, MAX_FONT_SIZE)), []);
	const decrease = useCallback(() => setSize((s) => Math.max(s - FONT_SIZE_STEP, MIN_FONT_SIZE)), []);
	const set = useCallback((s: number) => setSize(Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, s))), []);

	return { size: size, increase: increase, decrease: decrease, set: set };
}
