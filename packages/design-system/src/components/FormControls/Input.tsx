import type React from "react";
import styles from "./FormControls.module.css";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

function s(name: string | undefined): string {
  return name ?? "";
}

export function Input({ className, ...props }: InputProps) {
  return <input {...props} className={`${s(styles["input"])} ${className ?? ""}`} />;
}
