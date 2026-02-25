import type React from "react";
import styles from "./Layout.module.css";

interface ContentHeaderProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function ContentHeader({ left, right }: ContentHeaderProps) {
  return (
    <div className={s(styles["header"])}>
      <div className={s(styles["headerLeft"])}>{left}</div>
      <div className={s(styles["headerRight"])}>{right}</div>
    </div>
  );
}
