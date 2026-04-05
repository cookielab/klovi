import type React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "primary";
	size?: "sm" | "md";
	icon?: boolean;
}

const BASE_CLASSES =
	"inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.85rem] cursor-pointer border border-border transition-colors duration-150";

const VARIANT_CLASSES = {
	default: "bg-surface text-foreground hover:bg-surface-muted hover:border-foreground-subtle",
	primary: "bg-accent text-foreground-inverse border-accent hover:bg-accent-hover hover:border-accent-hover",
} as const;

const SIZE_SM_CLASSES = "px-2 py-1 text-[0.8rem] h-7";

const ICON_CLASSES = "p-1 min-w-7 justify-center";

export function Button({ variant = "default", size = "md", icon, className, ...props }: ButtonProps) {
	const classes = [
		BASE_CLASSES,
		VARIANT_CLASSES[variant],
		size === "sm" ? SIZE_SM_CLASSES : "",
		icon ? ICON_CLASSES : "",
		className ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return <button type="button" {...props} className={classes} />;
}
