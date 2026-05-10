import type React from "react";

type ContentHeaderProps = {
	left?: React.ReactNode;
	right?: React.ReactNode;
};

export function ContentHeader({ left, right }: ContentHeaderProps): React.ReactNode {
	return (
		<div className="sticky top-0 z-[5] flex h-header flex-shrink-0 items-center justify-between border-border border-b bg-surface px-5">
			<div className="flex items-center gap-2 font-semibold text-[0.95rem] text-foreground">{left}</div>
			<div className="flex items-center gap-2">{right}</div>
		</div>
	);
}
