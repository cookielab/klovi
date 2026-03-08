import type React from "react";
import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary";
  size?: "sm" | "md";
  icon?: boolean;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Button({
  variant = "default",
  size = "md",
  icon,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    s(styles["btn"]),
    variant === "primary" ? s(styles["primary"]) : "",
    size === "sm" ? s(styles["sm"]) : "",
    icon ? s(styles["icon"]) : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type="button" {...props} className={classes} />;
}
