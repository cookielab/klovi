import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("ccvie-theme");
    return (stored === "dark" ? "dark" : "light") as Theme;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ccvie-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggle };
}

export function useFontSize() {
  const [size, setSize] = useState(() => {
    const stored = localStorage.getItem("ccvie-font-size");
    return stored ? parseInt(stored, 10) : 15;
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-size-base",
      `${size}px`
    );
    localStorage.setItem("ccvie-font-size", String(size));
  }, [size]);

  const increase = useCallback(() => setSize((s) => Math.min(s + 2, 28)), []);
  const decrease = useCallback(() => setSize((s) => Math.max(s - 2, 10)), []);

  return { size, increase, decrease };
}
