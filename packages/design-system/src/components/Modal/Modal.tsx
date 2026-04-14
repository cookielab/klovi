import type React from "react";
import { useCallback, useEffect } from "react";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	width?: number;
	children: React.ReactNode;
};

function stopPropagation(e: React.MouseEvent): void {
	e.stopPropagation();
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
		if (!open) {
			return;
		}
		globalThis.addEventListener("keydown", handleKeyDown);
		return () => globalThis.removeEventListener("keydown", handleKeyDown);
	}, [open, handleKeyDown]);

	if (!open) {
		return null;
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: overlay click handled via keyboard Escape
		// biome-ignore lint/a11y/noStaticElementInteractions: overlay backdrop
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: overlay backdrop dismisses modal
		<div className="fixed inset-0 z-[200] flex justify-center bg-black/40 pt-[15vh]" onClick={onClose}>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: inner click stop propagation */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: dialog stops click propagation */}
			<div
				className="flex max-h-[480px] flex-col overflow-hidden border border-border bg-surface shadow-lg"
				role="dialog"
				style={{ width: width }}
				onClick={stopPropagation}
			>
				{children}
			</div>
		</div>
	);
}
