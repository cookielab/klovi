import type React from "react";
import { useCallback, useEffect } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Modal({ open, onClose, width = 560, children }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay click handled via keyboard Escape
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay backdrop
    <div className={s(styles["overlay"])} onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: inner click stop propagation */}
      <div
        className={s(styles["modal"])}
        role="dialog"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
