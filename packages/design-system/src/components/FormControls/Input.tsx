import type React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const INPUT_CLASSES =
	"w-full px-3 py-2 border border-border bg-surface text-foreground text-[0.85rem] outline-none font-[inherit] focus:border-accent";

export function Input({ className, ...props }: InputProps) {
	return <input {...props} className={`${INPUT_CLASSES} ${className ?? ""}`} />;
}
