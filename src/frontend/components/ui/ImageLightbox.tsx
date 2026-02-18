import { useCallback, useEffect, useState } from "react";

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
    <div className={`lightbox-overlay ${visible ? "lightbox-visible" : ""}`} onClick={handleClose}>
      <img className="lightbox-image" src={src} alt="Full size preview" />
    </div>
  );
}
