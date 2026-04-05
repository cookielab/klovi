import type React from "react";

interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
}

const SIDEBAR_BUTTON_CLASSES =
	"flex items-center justify-center gap-1 px-2 py-1 border border-border bg-surface text-foreground-subtle text-[0.75rem] font-[inherit] cursor-pointer transition-colors duration-150 hover:text-foreground hover:border-foreground-subtle first-of-type:ml-auto";

export function SidebarButton({ className, ...props }: SidebarButtonProps) {
	const classes = [SIDEBAR_BUTTON_CLASSES, className ?? ""].filter(Boolean).join(" ");

	return <button type="button" {...props} className={classes} />;
}
