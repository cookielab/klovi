import { useEffect, useState } from "react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";

export interface PluginRowProps {
  plugin: PluginSettingInfo;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onBrowse: (pluginId: string, currentDir: string) => void;
  onPathChange: (pluginId: string, dataDir: string) => void;
  onReset: (pluginId: string) => void;
}

export function PluginRow({ plugin, onToggle, onBrowse, onPathChange, onReset }: PluginRowProps) {
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
            className="custom-checkbox"
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
