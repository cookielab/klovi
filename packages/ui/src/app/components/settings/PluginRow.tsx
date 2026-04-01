import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";

export type PluginRowProps = {
	plugin: PluginSettingInfo;
	onToggle: (pluginId: string, enabled: boolean) => void;
	onBrowse: (pluginId: string, currentDir: string) => void;
	onPathChange: (pluginId: string, dataDir: string) => void;
	onReset: (pluginId: string) => void;
	canBrowse?: boolean;
};

export function PluginRow({ plugin, onToggle, onBrowse, onPathChange, onReset, canBrowse = true }: PluginRowProps) {
	const customPath = plugin.isCustomDir ? plugin.dataDir : "";
	const [editingPath, setEditingPath] = useState(customPath);

	useEffect(() => {
		setEditingPath(plugin.isCustomDir ? plugin.dataDir : "");
	}, [plugin.dataDir, plugin.isCustomDir]);

	const commitPath = useCallback(() => {
		const trimmed = editingPath.trim();
		if (trimmed === "" && plugin.isCustomDir) {
			onReset(plugin.id);
		} else if (trimmed !== "" && trimmed !== plugin.dataDir) {
			onPathChange(plugin.id, trimmed);
		}
	}, [editingPath, plugin.isCustomDir, plugin.id, plugin.dataDir, onReset, onPathChange]);

	const handlePathKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitPath();
			}
		},
		[commitPath],
	);

	const handleToggle = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => onToggle(plugin.id, e.target.checked),
		[onToggle, plugin.id],
	);

	const handlePathInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => setEditingPath(e.target.value),
		[],
	);

	const handleBrowse = useCallback(() => onBrowse(plugin.id, plugin.dataDir), [onBrowse, plugin.id, plugin.dataDir]);

	const handleReset = useCallback(() => onReset(plugin.id), [onReset, plugin.id]);

	return (
		<div className={`settings-plugin-row ${plugin.enabled ? "" : "disabled"}`}>
			<div className="settings-plugin-header">
				<label className="settings-plugin-label">
					<input type="checkbox" className="custom-checkbox" checked={plugin.enabled} onChange={handleToggle} />
					<span className="settings-plugin-name">{plugin.displayName}</span>
				</label>
			</div>
			<div className="settings-plugin-path">
				<input
					type="text"
					className="settings-path-input"
					value={editingPath}
					placeholder={plugin.defaultDataDir}
					onChange={handlePathInputChange}
					onBlur={commitPath}
					onKeyDown={handlePathKeyDown}
					disabled={!plugin.enabled}
				/>
				{canBrowse ? (
					<button type="button" className="btn btn-sm" onClick={handleBrowse} disabled={!plugin.enabled}>
						Browse
					</button>
				) : null}
				{plugin.isCustomDir ? (
					<button type="button" className="settings-reset-link" onClick={handleReset} disabled={!plugin.enabled}>
						Reset
					</button>
				) : null}
			</div>
		</div>
	);
}
