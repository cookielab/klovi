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

export function Modal({ open, onClose, width = 560, children }: ModalProps): React.ReactNode {
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
		<div className="fixed inset-0 z-[200] flex justify-center bg-black/40 pt-[15vh]" onClick={onClose}>
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
