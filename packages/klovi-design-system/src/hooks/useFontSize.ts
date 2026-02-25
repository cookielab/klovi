import { useCallback, useEffect, useState } from "react";

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
