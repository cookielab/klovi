import { useCallback } from "react";

type ToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: string;
	disabled?: boolean;
};

const TOGGLE_CLASSES =
	"relative w-9 h-5 rounded-[10px] border-[1.5px] border-border bg-surface-sunken cursor-pointer transition-colors duration-150 shrink-0 appearance-none " +
	"after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3.5 after:h-3.5 after:rounded-full after:bg-foreground-subtle after:transition-all after:duration-150 " +
	"checked:bg-accent checked:border-accent checked:after:translate-x-4 checked:after:bg-foreground-inverse " +
	"disabled:opacity-50 disabled:cursor-default";

export function Toggle({ checked, onChange, label, disabled }: ToggleProps): React.ReactNode {
	const handleChange = useCallback(() => {
		onChange(!checked);
	}, [checked, onChange]);

	return (
		<label className="flex items-center gap-2">
			<input type="checkbox" className={TOGGLE_CLASSES} checked={checked} onChange={handleChange} disabled={disabled} />
			{label ? <span className="cursor-pointer text-[0.85rem] text-foreground-muted">{label}</span> : null}
		</label>
	);
}
