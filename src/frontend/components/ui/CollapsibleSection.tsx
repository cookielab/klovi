import type React from "react";
import { useState } from "react";

interface CollapsibleSectionProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible">
      <button type="button" className="collapsible-header" onClick={() => setOpen(!open)}>
        <span className={`collapsible-chevron ${open ? "open" : ""}`}>▶</span>
        {title}
      </button>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}
