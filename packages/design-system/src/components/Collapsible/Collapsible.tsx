import type React from "react";
import { useState } from "react";
import styles from "./Collapsible.module.css";

interface CollapsibleProps {
  title: React.ReactNode;
  defaultOpen?: boolean | undefined;
  children: React.ReactNode;
}

function s(name: string | undefined): string {
  return name ?? "";
}

export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={s(styles["collapsible"])}>
      <button type="button" className={s(styles["header"])} onClick={() => setOpen(!open)}>
        <span className={`${s(styles["chevron"])} ${open ? s(styles["chevronOpen"]) : ""}`}>
          &#x25B6;
        </span>
        {title}
      </button>
      {open && <div className={s(styles["content"])}>{children}</div>}
    </div>
  );
}
