import { useCallback } from "react";
import styles from "./FormControls.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const handleChange = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);

  return (
    <label className={s(styles["toggleWrapper"])}>
      <input
        type="checkbox"
        className={s(styles["toggle"])}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      {label && <span className={s(styles["toggleLabel"])}>{label}</span>}
    </label>
  );
}
