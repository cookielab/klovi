import { useEffect } from "react";

interface KeyboardHandlers {
  onNext?: () => void;
  onPrev?: () => void;
  onNextTurn?: () => void;
  onPrevTurn?: () => void;
  onEscape?: () => void;
  onFullscreen?: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers, active: boolean) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          handlers.onNext?.();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case "ArrowDown":
          e.preventDefault();
          handlers.onNextTurn?.();
          break;
        case "ArrowUp":
          e.preventDefault();
          handlers.onPrevTurn?.();
          break;
        case "Escape":
          e.preventDefault();
          handlers.onEscape?.();
          break;
        case "f":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers.onFullscreen?.();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, handlers]);
}
