import { useCallback, useEffect, useState } from "react";

export type ThemeSetting = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === "system") return getSystemTheme();
  return setting;
}

export function useTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const stored = localStorage.getItem("klovi-theme");
    if (stored === "light" || stored === "dark") return stored;
    return "system";
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(setting));

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  // Persist setting
  useEffect(() => {
    localStorage.setItem("klovi-theme", setting);
    setResolved(resolveTheme(setting));
  }, [setting]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (setting !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setting]);

  const cycle = useCallback(() => {
    setSetting((s) => {
      if (s === "system") return "light";
      if (s === "light") return "dark";
      return "system";
    });
  }, []);

  return { setting, resolved, cycle };
}

export function useFontSize() {
  const [size, setSize] = useState(() => {
    const stored = localStorage.getItem("klovi-font-size");
    return stored ? parseInt(stored, 10) : 15;
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", `${size}px`);
    localStorage.setItem("klovi-font-size", String(size));
  }, [size]);

  const increase = useCallback(() => setSize((s) => Math.min(s + 2, 28)), []);
  const decrease = useCallback(() => setSize((s) => Math.max(s - 2, 10)), []);

  return { size, increase, decrease };
}
