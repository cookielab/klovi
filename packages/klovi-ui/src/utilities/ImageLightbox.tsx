import { useCallback, useEffect, useState } from "react";
import styles from "./ImageLightbox.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    // Double rAF ensures the browser paints the initial (hidden) frame
    // before we trigger the CSS transition to the visible state.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: lightbox backdrop dismiss
    <div
      className={`${s(styles["lightboxOverlay"])} ${visible ? s(styles["lightboxVisible"]) : ""}`}
      role="presentation"
      onClick={handleClose}
    >
      <img className={s(styles["lightboxImage"])} src={src} alt="Full size preview" />
    </div>
  );
}
