import type { ThemeSetting } from "@cookielab.io/klovi-design-system";
import { useCallback, useEffect, useState } from "react";

export type { ThemeSetting } from "@cookielab.io/klovi-design-system";
// Re-export core theme hooks from DS
export { resolveTheme, useFontSize, useTheme } from "@cookielab.io/klovi-design-system";

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
