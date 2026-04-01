import type React from "react";
import { useCallback, useEffect } from "react";
import styles from "./Modal.module.css";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	width?: number;
	children: React.ReactNode;
};

function s(name: string | undefined): string {
	return name ?? "";
}

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
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, handleKeyDown]);

	if (!open) {
		return null;
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: overlay click handled via keyboard Escape
		// biome-ignore lint/a11y/noStaticElementInteractions: overlay backdrop
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: overlay backdrop dismisses modal
		<div className={s(styles["overlay"])} onClick={onClose}>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: inner click stop propagation */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: dialog stops click propagation */}
			<div className={s(styles["modal"])} role="dialog" style={{ width: width }} onClick={stopPropagation}>
				{children}
			</div>
		</div>
	);
}
