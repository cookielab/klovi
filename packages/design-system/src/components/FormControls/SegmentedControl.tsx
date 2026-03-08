import styles from "./FormControls.module.css";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div className={`${s(styles["segmented"])} ${disabled ? s(styles["segmentedDisabled"]) : ""}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${s(styles["segmentedOption"])} ${value === opt.value ? s(styles["segmentedOptionActive"]) : ""}`}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
