import { useCallback, useEffect, useState } from "react";

const N_200 = 200;
const N_800 = 800;
const N_600 = 600;

const OVERLAY_BASE =
	"fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer transition-colors duration-200 ease-[ease]";

const IMAGE_BASE = "max-w-[90vw] max-h-[90vh] object-contain transition-[opacity,transform] duration-200 ease-[ease]";

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }): React.ReactNode {
	const [visible, setVisible] = useState(false);

	const handleClose = useCallback(() => {
		const transitionDuration = N_200;
		setVisible(false);
		setTimeout(onClose, transitionDuration);
	}, [onClose]);

	useEffect(() => {
		// Double rAF ensures the browser paints the initial (hidden) frame
		// before we trigger the CSS transition to the visible state.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => setVisible(true));
		});
	}, []);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent): void => {
			if (e.key === "Escape") {
				handleClose();
			}
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [handleClose]);

	return (
		<button
			type="button"
			className={`${OVERLAY_BASE} ${visible ? "bg-black/85" : "bg-black/0"} appearance-none border-0`}
			aria-label="Close image preview"
			onClick={handleClose}
		>
			<img
				className={`${IMAGE_BASE} ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
				src={src}
				alt="Full size preview"
				width={N_800}
				height={N_600}
			/>
		</button>
	);
}
