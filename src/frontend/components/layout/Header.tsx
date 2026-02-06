interface HeaderProps {
  title: string;
  breadcrumb?: string;
  themeSetting: "system" | "light" | "dark";
  onCycleTheme: () => void;
  fontSize: number;
  onIncreaseFontSize: () => void;
  onDecreaseFontSize: () => void;
  presentationActive: boolean;
  onTogglePresentation: () => void;
  showPresentationToggle: boolean;
}

export function Header({
  title,
  breadcrumb,
  themeSetting,
  onCycleTheme,
  fontSize,
  onIncreaseFontSize,
  onDecreaseFontSize,
  presentationActive,
  onTogglePresentation,
  showPresentationToggle,
}: HeaderProps) {
  return (
    <div className="header">
      <div className="header-title">
        {breadcrumb && (
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{breadcrumb} /&nbsp;</span>
        )}
        {title}
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="btn btn-sm btn-icon"
          onClick={onDecreaseFontSize}
          title="Decrease font size"
        >
          A-
        </button>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            minWidth: 30,
            textAlign: "center",
          }}
        >
          {fontSize}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-icon"
          onClick={onIncreaseFontSize}
          title="Increase font size"
        >
          A+
        </button>

        <button type="button" className="btn btn-sm" onClick={onCycleTheme}>
          {themeSetting === "system" ? "System" : themeSetting === "light" ? "Light" : "Dark"}
        </button>

        {showPresentationToggle && (
          <button
            type="button"
            className={`btn btn-sm ${presentationActive ? "btn-primary" : ""}`}
            onClick={onTogglePresentation}
          >
            {presentationActive ? "Exit Presentation" : "Present"}
          </button>
        )}
      </div>
    </div>
  );
}
