import type React from "react";
import { useCallback, useState } from "react";

type CollapsibleProps = {
	title: React.ReactNode;
	defaultOpen?: boolean | undefined;
	children: React.ReactNode;
};

const HEADER_CLASSES =
	"flex items-center gap-1.5 w-full px-2 py-1 cursor-pointer text-[0.82rem] font-medium text-foreground-muted bg-none border-0 font-[inherit] text-left select-none transition-colors duration-100 hover:bg-surface-muted";

export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
	const [open, setOpen] = useState(defaultOpen);
	const handleToggle = useCallback(() => setOpen((prev) => !prev), []);

	return (
		<div className="my-1">
			<button type="button" className={HEADER_CLASSES} onClick={handleToggle}>
				<span
					className={`inline-block text-[0.6rem] text-foreground-subtle transition-transform duration-150 ${open ? "rotate-90" : ""}`}
				>
					&#x25B6;
				</span>
				{title}
			</button>
			{open ? (
				<div className="ml-[18px] max-h-[500px] overflow-y-auto border-border-muted border-l-2 px-3 py-2.5">
					{children}
				</div>
			) : null}
		</div>
	);
}
