import type React from "react";
import { useCallback, useEffect } from "react";

const N_560 = 560;

type ModalProps = {
	open: boolean;
	onClose: () => void;
	width?: number;
	children: React.ReactNode;
};

export function Modal({ open, onClose, width = N_560, children }: ModalProps): React.ReactNode {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[onClose],
	);

	const handleBackdropClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	const handleBackdropKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>) => {
			if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
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
		<button
			type="button"
			aria-label="Close modal"
			className="fixed inset-0 z-[200] flex justify-center bg-black/40 pt-[15vh]"
			onClick={handleBackdropClick}
			onKeyDown={handleBackdropKeyDown}
		>
			<div
				className="flex max-h-[480px] flex-col overflow-hidden border border-border bg-surface shadow-lg"
				role="dialog"
				aria-modal="true"
				style={{ width: `${width}px` }}
			>
				{children}
			</div>
		</button>
	);
}
