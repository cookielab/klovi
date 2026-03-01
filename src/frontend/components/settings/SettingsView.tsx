import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PluginSettingInfo,
  UpdateChannel,
  UpdateSettingsInfo,
  UpdateStatus,
} from "../../../shared/rpc-types.ts";
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

function formatUpdateStatus(updateStatus: UpdateStatus | null): string {
  if (updateStatus?.status === "downloading" && updateStatus.progress !== undefined) {
    return `Downloading v${updateStatus.latestVersion} (${updateStatus.progress}%)`;
  }
  if (updateStatus?.status === "ready") {
    return `v${updateStatus.latestVersion} ready to install`;
  }
  if (updateStatus?.status === "available") {
    return `v${updateStatus.latestVersion} available`;
  }
  if (updateStatus?.status === "error") {
    return `Error: ${updateStatus.error}`;
  }
  return "Up to date";
}

function UpdatesTab({
  loading,
  updateSettings,
  setUpdateSettings,
  setChanged,
}: {
  loading: boolean;
  updateSettings: UpdateSettingsInfo | null;
  setUpdateSettings: (s: UpdateSettingsInfo) => void;
  setChanged: (v: boolean) => void;
}) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  return (
    <>
      <h3 className="settings-section-title">Updates</h3>
      {loading ? (
        <div className="settings-loading">Loading...</div>
      ) : (
        updateSettings && (
          <>
            <div className="settings-control-row">
              <span className="settings-control-label">Update Channel</span>
              <select
                className="settings-select"
                value={updateSettings.channel}
                onChange={(e) => {
                  const channel = e.target.value as UpdateChannel;
                  setUpdateSettings({ ...updateSettings, channel });
                  getRPC()
                    .request.updateUpdateSettings({ channel })
                    .then(() => setChanged(true))
                    .catch(() => {});
                }}
              >
                <option value="stable">Stable</option>
                <option value="candidate">Release Candidate</option>
                <option value="beta">Beta</option>
              </select>
            </div>

            <div className="settings-control-row">
              <span className="settings-control-label">Check Interval</span>
              <select
                className="settings-select"
                value={updateSettings.checkIntervalHours}
                onChange={(e) => {
                  const checkIntervalHours = Number(e.target.value);
                  setUpdateSettings({ ...updateSettings, checkIntervalHours });
                  getRPC()
                    .request.updateUpdateSettings({ checkIntervalHours })
                    .then(() => setChanged(true))
                    .catch(() => {});
                }}
              >
                <option value={1}>Every hour</option>
                <option value={3}>Every 3 hours</option>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
              </select>
            </div>

            <div className="settings-control-row">
              <div className="settings-control-group">
                <label className="settings-same-as-global">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={updateSettings.autoDownload}
                    onChange={(e) => {
                      const autoDownload = e.target.checked;
                      setUpdateSettings({ ...updateSettings, autoDownload });
                      getRPC()
                        .request.updateUpdateSettings({ autoDownload })
                        .then(() => setChanged(true))
                        .catch(() => {});
                    }}
                  />
                  Auto-download updates
                </label>
                <p className="settings-general-hint">
                  When enabled, updates are downloaded in the background automatically.
                </p>
              </div>
            </div>

            <h4 className="settings-subsection-title">Status</h4>
            <div className="settings-control-row">
              <div className="settings-control-group">
                <div className="settings-update-status">{formatUpdateStatus(updateStatus)}</div>
                <button
                  type="button"
                  className="settings-reset-to-defaults-btn"
                  disabled={checking}
                  onClick={() => {
                    setChecking(true);
                    getRPC()
                      .request.checkForUpdate({} as Record<string, never>)
                      .then((result) => setUpdateStatus(result))
                      .catch(() => {})
                      .finally(() => setChecking(false));
                  }}
                >
                  {checking ? "Checking..." : "Check now"}
                </button>
              </div>
            </div>
          </>
        )
      )}
    </>
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
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const resettingRef = useRef(false);
  const [updateSettings, setUpdateSettings] = useState<UpdateSettingsInfo | null>(null);

  useEffect(() => {
    Promise.all([
      getRPC().request.getPluginSettings({} as Record<string, never>),
      getRPC().request.getGeneralSettings({} as Record<string, never>),
      getRPC().request.getUpdateSettings({} as Record<string, never>),
    ])
      .then(([pluginData, generalData, updateData]) => {
        setPlugins(pluginData.plugins);
        setShowSecurityWarning(generalData.showSecurityWarning);
        setUpdateSettings(updateData);
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

  const handleResetToDefaults = useCallback(() => {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    getRPC()
      .request.resetSettings({} as Record<string, never>)
      .then(() => {
        const keys = [
          "klovi-theme",
          "klovi-font-size",
          "klovi-hidden-projects",
          "klovi-presentation-theme",
          "klovi-presentation-same-theme",
          "klovi-presentation-font-size",
          "klovi-presentation-same-font-size",
        ];
        for (const key of keys) {
          localStorage.removeItem(key);
        }
        window.dispatchEvent(new CustomEvent("klovi:reset"));
      })
      .catch(() => {
        resettingRef.current = false;
        setResetting(false);
        setConfirmingReset(false);
      });
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
        {activeTab === "updates" && (
          <UpdatesTab
            loading={loading}
            updateSettings={updateSettings}
            setUpdateSettings={setUpdateSettings}
            setChanged={setChanged}
          />
        )}
        {activeTab === "general" && (
          <>
            <h3 className="settings-section-title">General</h3>
            {loading ? (
              <div className="settings-loading">Loading...</div>
            ) : (
              <>
                <div className="settings-control-row">
                  <div className="settings-control-group">
                    <label className="settings-same-as-global">
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
                      Show security warning on startup
                    </label>
                    <p className="settings-general-hint">
                      When enabled, the security warning is shown each time Klovi launches.
                    </p>
                  </div>
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

                <h4 className="settings-subsection-title">Reset</h4>
                <div className="settings-control-row">
                  {!confirmingReset ? (
                    <div className="settings-control-group">
                      <button
                        type="button"
                        className="settings-reset-to-defaults-btn"
                        disabled={resetting}
                        onClick={() => setConfirmingReset(true)}
                      >
                        Reset to defaults
                      </button>
                      <p className="settings-general-hint">
                        Deletes all settings and returns to the home screen.
                      </p>
                    </div>
                  ) : (
                    <div className="settings-control-group">
                      <p className="settings-reset-confirm-text">
                        Reset all settings to defaults? This cannot be undone.
                      </p>
                      <div className="settings-reset-confirm-actions">
                        <button
                          type="button"
                          className="settings-reset-confirm-btn"
                          disabled={resetting}
                          onClick={handleResetToDefaults}
                        >
                          {resetting ? "Resetting..." : "Yes, reset everything"}
                        </button>
                        <button
                          type="button"
                          className="settings-reset-cancel-btn"
                          disabled={resetting}
                          onClick={() => setConfirmingReset(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
