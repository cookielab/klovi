import { useCallback } from "react";
import styles from "./FormControls.module.css";

type SegmentedControlProps<T extends string> = {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: string }[];
	disabled?: boolean;
};

function s(name: string | undefined): string {
	return name ?? "";
}

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
			className={`${s(styles["segmentedOption"])} ${isActive ? s(styles["segmentedOptionActive"]) : ""}`}
			disabled={disabled}
			onClick={handleClick}
		>
			{opt.label}
		</button>
	);
}

export function SegmentedControl<T extends string>({ value, onChange, options, disabled }: SegmentedControlProps<T>) {
	return (
		<div className={`${s(styles["segmented"])} ${disabled ? s(styles["segmentedDisabled"]) : ""}`}>
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
