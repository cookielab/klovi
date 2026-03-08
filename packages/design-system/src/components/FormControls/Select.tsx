import type React from "react";
import styles from "./FormControls.module.css";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <select {...props} className={`${s(styles["select"])} ${className ?? ""}`}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
