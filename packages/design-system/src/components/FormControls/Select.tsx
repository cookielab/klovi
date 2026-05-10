import type React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	options: { value: string; label: string }[];
}

const SELECT_CLASSES =
	"w-full px-3 py-2 border border-border bg-surface text-foreground text-[0.85rem] outline-none font-[inherit] cursor-pointer focus:border-accent";

export function Select({ options, className, ...props }: SelectProps): React.ReactNode {
	return (
		<select {...props} className={`${SELECT_CLASSES} ${className ?? ""}`}>
			{options.map((opt) => (
				<option key={opt.value} value={opt.value}>
					{opt.label}
				</option>
			))}
		</select>
	);
}
