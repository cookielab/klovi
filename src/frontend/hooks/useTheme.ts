import { useCallback, useEffect, useState } from "react";

export type ThemeSetting = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(setting: ThemeSetting): ResolvedTheme {
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

  const set = useCallback((theme: ThemeSetting) => {
    setSetting(theme);
  }, []);

  return { setting, resolved, cycle, set };
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
  const set = useCallback((s: number) => setSize(Math.max(10, Math.min(28, s))), []);

  return { size, increase, decrease, set };
}

export function usePresentationTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const stored = localStorage.getItem("klovi-presentation-theme");
    if (stored === "light" || stored === "dark") return stored;
    return "system";
  });

  const [sameAsGlobal, setSameAsGlobalState] = useState(() => {
    return localStorage.getItem("klovi-presentation-same-theme") !== "false";
  });

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
      if (s === "system") return "light";
      if (s === "light") return "dark";
      return "system";
    });
  }, []);

  const setSameAsGlobal = useCallback((v: boolean) => {
    setSameAsGlobalState(v);
  }, []);

  return { setting, sameAsGlobal, setSameAsGlobal, set, cycle };
}

export function usePresentationFontSize() {
  const [size, setSize] = useState(() => {
    const stored = localStorage.getItem("klovi-presentation-font-size");
    return stored ? parseInt(stored, 10) : 15;
  });

  const [sameAsGlobal, setSameAsGlobalState] = useState(() => {
    return localStorage.getItem("klovi-presentation-same-font-size") !== "false";
  });

  useEffect(() => {
    localStorage.setItem("klovi-presentation-font-size", String(size));
  }, [size]);

  useEffect(() => {
    localStorage.setItem("klovi-presentation-same-font-size", String(sameAsGlobal));
  }, [sameAsGlobal]);

  const increase = useCallback(() => setSize((s) => Math.min(s + 2, 28)), []);
  const decrease = useCallback(() => setSize((s) => Math.max(s - 2, 10)), []);
  const set = useCallback((s: number) => setSize(Math.max(10, Math.min(28, s))), []);

  const setSameAsGlobal = useCallback((v: boolean) => {
    setSameAsGlobalState(v);
  }, []);

  return { size, sameAsGlobal, setSameAsGlobal, set, increase, decrease };
}
