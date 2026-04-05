import { useCallback } from "react";

type SegmentedControlProps<T extends string> = {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: string }[];
	disabled?: boolean;
};

const OPTION_BASE =
	"border-0 border-r border-border last:border-r-0 px-[14px] py-[5px] text-[0.85rem] cursor-pointer disabled:cursor-default disabled:opacity-50";

const OPTION_ACTIVE = "bg-accent-subtle text-accent font-medium";
const OPTION_INACTIVE = "bg-surface text-foreground-muted enabled:hover:bg-surface-muted";

function SegmentedOption<T extends string>({
	opt,
	isActive,
	disabled,
	onChange,
}: {
	opt: { value: T; label: string };
	isActive: boolean;
	disabled: boolean | undefined;
	onChange: (value: T) => void;
}) {
	const handleClick = useCallback(() => onChange(opt.value), [onChange, opt.value]);
	return (
		<button
			type="button"
			className={`${OPTION_BASE} ${isActive ? OPTION_ACTIVE : OPTION_INACTIVE}`}
			disabled={disabled}
			onClick={handleClick}
		>
			{opt.label}
		</button>
	);
}

export function SegmentedControl<T extends string>({ value, onChange, options, disabled }: SegmentedControlProps<T>) {
	return (
		<div
			className={`inline-flex overflow-hidden border border-border ${disabled ? "pointer-events-none opacity-50" : ""}`}
		>
			{options.map((opt) => (
				<SegmentedOption
					key={opt.value}
					opt={opt}
					isActive={value === opt.value}
					disabled={disabled}
					onChange={onChange}
				/>
			))}
		</div>
	);
}
