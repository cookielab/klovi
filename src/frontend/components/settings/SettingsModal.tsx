import { useCallback, useEffect, useState } from "react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { getRPC } from "../../rpc.ts";
import "./SettingsModal.css";

interface SettingsModalProps {
  onClose: (changed: boolean) => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);

  const close = useCallback(() => onClose(changed), [onClose, changed]);

  useEffect(() => {
    getRPC()
      .request.getPluginSettings({} as Record<string, never>)
      .then((data) => {
        setPlugins(data.plugins);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

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
    <div className="settings-overlay" onMouseDown={close} onKeyDown={() => {}}>
      <div className="settings-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            onClick={close}
          >
            &times;
          </button>
        </div>
        <div className="settings-body">
          <nav className="settings-sidebar">
            <button type="button" className="settings-tab active">
              Plugins
            </button>
            <button type="button" className="settings-tab" disabled>
              General
            </button>
          </nav>
          <div className="settings-content">
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
          </div>
        </div>
      </div>
    </div>
  );
}

interface PluginRowProps {
  plugin: PluginSettingInfo;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onBrowse: (pluginId: string, currentDir: string) => void;
  onPathChange: (pluginId: string, dataDir: string) => void;
  onReset: (pluginId: string) => void;
}

function PluginRow({ plugin, onToggle, onBrowse, onPathChange, onReset }: PluginRowProps) {
  const customPath = plugin.isCustomDir ? plugin.dataDir : "";
  const [editingPath, setEditingPath] = useState(customPath);

  useEffect(() => {
    setEditingPath(plugin.isCustomDir ? plugin.dataDir : "");
  }, [plugin.dataDir, plugin.isCustomDir]);

  const commitPath = () => {
    const trimmed = editingPath.trim();
    if (trimmed === "" && plugin.isCustomDir) {
      onReset(plugin.id);
    } else if (trimmed !== "" && trimmed !== plugin.dataDir) {
      onPathChange(plugin.id, trimmed);
    }
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPath();
    }
  };

  return (
    <div className={`settings-plugin-row ${!plugin.enabled ? "disabled" : ""}`}>
      <div className="settings-plugin-header">
        <label className="settings-plugin-label">
          <input
            type="checkbox"
            checked={plugin.enabled}
            onChange={(e) => onToggle(plugin.id, e.target.checked)}
          />
          <span className="settings-plugin-name">{plugin.displayName}</span>
        </label>
      </div>
      <div className="settings-plugin-path">
        <input
          type="text"
          className="settings-path-input"
          value={editingPath}
          placeholder={plugin.defaultDataDir}
          onChange={(e) => setEditingPath(e.target.value)}
          onBlur={commitPath}
          onKeyDown={handlePathKeyDown}
          disabled={!plugin.enabled}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onBrowse(plugin.id, plugin.dataDir)}
          disabled={!plugin.enabled}
        >
          Browse
        </button>
        {plugin.isCustomDir && (
          <button
            type="button"
            className="settings-reset-link"
            onClick={() => onReset(plugin.id)}
            disabled={!plugin.enabled}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
