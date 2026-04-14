import { useCallback, useEffect, useState } from "react";

const OVERLAY_BASE =
	"fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer transition-colors duration-200 ease-[ease]";

const IMAGE_BASE = "max-w-[90vw] max-h-[90vh] object-contain transition-[opacity,transform] duration-200 ease-[ease]";

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
			if (e.key === "Escape") {
				handleClose();
			}
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [handleClose]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: lightbox backdrop dismiss
		<div
			className={`${OVERLAY_BASE} ${visible ? "bg-black/85" : "bg-black/0"}`}
			role="presentation"
			onClick={handleClose}
		>
			<img
				className={`${IMAGE_BASE} ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
				src={src}
				alt="Full size preview"
				width={800}
				height={600}
			/>
		</div>
	);
}
