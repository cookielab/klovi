import type { GlobalProvider } from "@ladle/react";
import { useEffect } from "react";
import "../src/globals/index.ts";

const resolveTheme = (theme: string): "light" | "dark" => {
	if (theme === "auto") {
		return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}
	return theme === "dark" ? "dark" : "light";
};

export const Provider: GlobalProvider = ({ children, globalState }) => {
	useEffect(() => {
		const resolved = resolveTheme(globalState.theme);
		document.documentElement.dataset["theme"] = resolved;
	}, [globalState.theme]);
	return <>{children}</>;
};
