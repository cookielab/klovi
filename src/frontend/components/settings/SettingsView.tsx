import { useCallback, useEffect, useState } from "react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import type { ThemeSetting } from "../../hooks/useTheme.ts";
import { getRPC } from "../../rpc.ts";
import { PluginRow } from "./PluginRow.tsx";
import type { SettingsTab } from "./SettingsSidebar.tsx";
import "./SettingsView.css";

interface ThemeProps {
  setting: ThemeSetting;
  set: (theme: ThemeSetting) => void;
}

interface FontSizeProps {
  size: number;
  set: (size: number) => void;
  increase: () => void;
  decrease: () => void;
}

interface PresentationThemeProps {
  setting: ThemeSetting;
  sameAsGlobal: boolean;
  setSameAsGlobal: (v: boolean) => void;
  set: (theme: ThemeSetting) => void;
}

interface PresentationFontSizeProps {
  size: number;
  sameAsGlobal: boolean;
  setSameAsGlobal: (v: boolean) => void;
  set: (size: number) => void;
  increase: () => void;
  decrease: () => void;
}

interface SettingsViewProps {
  activeTab: SettingsTab;
  onNavigateHome: () => void;
  theme: ThemeProps;
  fontSize: FontSizeProps;
  presentationTheme: PresentationThemeProps;
  presentationFontSize: PresentationFontSizeProps;
}

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeSelector({
  value,
  onChange,
  disabled,
}: {
  value: ThemeSetting;
  onChange: (v: ThemeSetting) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`settings-theme-selector ${disabled ? "disabled" : ""}`}>
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`settings-theme-option ${value === opt.value ? "active" : ""}`}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FontSizeControl({
  size,
  onIncrease,
  onDecrease,
  disabled,
}: {
  size: number;
  onIncrease: () => void;
  onDecrease: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`settings-font-size-control ${disabled ? "disabled" : ""}`}>
      <button type="button" disabled={disabled || size <= 10} onClick={onDecrease}>
        A-
      </button>
      <span className="settings-font-size-value">{size}</span>
      <button type="button" disabled={disabled || size >= 28} onClick={onIncrease}>
        A+
      </button>
    </div>
  );
}

export function SettingsView({
  activeTab,
  onNavigateHome,
  theme,
  fontSize,
  presentationTheme,
  presentationFontSize,
}: SettingsViewProps) {
  const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(true);

  useEffect(() => {
    Promise.all([
      getRPC().request.getPluginSettings({} as Record<string, never>),
      getRPC().request.getGeneralSettings({} as Record<string, never>),
    ])
      .then(([pluginData, generalData]) => {
        setPlugins(pluginData.plugins);
        setShowSecurityWarning(generalData.showSecurityWarning);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (changed) {
          onNavigateHome();
        } else {
          history.back();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changed, onNavigateHome]);

  const handleToggle = useCallback((pluginId: string, enabled: boolean) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, enabled })
      .then((data) => {
        setPlugins(data.plugins);
        setChanged(true);
      })
      .catch(() => {});
  }, []);

  const handleBrowse = useCallback((pluginId: string, currentDir: string) => {
    getRPC()
      .request.browseDirectory({ startingFolder: currentDir })
      .then((data) => {
        if (data.path) {
          return getRPC().request.updatePluginSetting({ pluginId, dataDir: data.path });
        }
        return null;
      })
      .then((data) => {
        if (data) {
          setPlugins(data.plugins);
          setChanged(true);
        }
      })
      .catch(() => {});
  }, []);

  const handlePathChange = useCallback((pluginId: string, dataDir: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir })
      .then((data) => {
        setPlugins(data.plugins);
        setChanged(true);
      })
      .catch(() => {});
  }, []);

  const handleReset = useCallback((pluginId: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir: null })
      .then((data) => {
        setPlugins(data.plugins);
        setChanged(true);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="settings-view">
      <div className="settings-content">
        {activeTab === "plugins" && (
          <>
            <h3 className="settings-section-title">Plugins</h3>
            {loading ? (
              <div className="settings-loading">Loading...</div>
            ) : (
              <div className="settings-plugin-list">
                {plugins.map((plugin) => (
                  <PluginRow
                    key={plugin.id}
                    plugin={plugin}
                    onToggle={handleToggle}
                    onBrowse={handleBrowse}
                    onPathChange={handlePathChange}
                    onReset={handleReset}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === "general" && (
          <>
            <h3 className="settings-section-title">General</h3>
            {loading ? (
              <div className="settings-loading">Loading...</div>
            ) : (
              <>
                <div className="settings-general-row">
                  <label className="settings-general-label">
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={showSecurityWarning}
                      onChange={(e) => {
                        const value = e.target.checked;
                        setShowSecurityWarning(value);
                        getRPC()
                          .request.updateGeneralSettings({ showSecurityWarning: value })
                          .then(() => setChanged(true))
                          .catch(() => {});
                      }}
                    />
                    Show on-boarding on startup
                  </label>
                  <p className="settings-general-hint">
                    When enabled, the on-boarding wizard is shown the next time Klovi launches.
                  </p>
                </div>

                <h4 className="settings-subsection-title">Global</h4>

                <div className="settings-control-row">
                  <span className="settings-control-label">Theme</span>
                  <ThemeSelector value={theme.setting} onChange={theme.set} />
                </div>

                <div className="settings-control-row">
                  <span className="settings-control-label">Font Size</span>
                  <FontSizeControl
                    size={fontSize.size}
                    onIncrease={fontSize.increase}
                    onDecrease={fontSize.decrease}
                  />
                </div>

                <h4 className="settings-subsection-title">Presentation</h4>

                <div className="settings-control-row">
                  <span className="settings-control-label">Theme</span>
                  <div className="settings-control-group">
                    <label className="settings-same-as-global">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={presentationTheme.sameAsGlobal}
                        onChange={(e) => presentationTheme.setSameAsGlobal(e.target.checked)}
                      />
                      Same as global
                    </label>
                    <ThemeSelector
                      value={presentationTheme.setting}
                      onChange={presentationTheme.set}
                      disabled={presentationTheme.sameAsGlobal}
                    />
                  </div>
                </div>

                <div className="settings-control-row">
                  <span className="settings-control-label">Font Size</span>
                  <div className="settings-control-group">
                    <label className="settings-same-as-global">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={presentationFontSize.sameAsGlobal}
                        onChange={(e) => presentationFontSize.setSameAsGlobal(e.target.checked)}
                      />
                      Same as global
                    </label>
                    <FontSizeControl
                      size={presentationFontSize.size}
                      onIncrease={presentationFontSize.increase}
                      onDecrease={presentationFontSize.decrease}
                      disabled={presentationFontSize.sameAsGlobal}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
