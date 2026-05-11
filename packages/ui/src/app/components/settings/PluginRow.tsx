import { Text } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { PluginRowProps } from "./PluginRow.types";

const T_BROWSE = "Browse";
const T_RESET = "Reset";

const ROW_BASE_CLASSES = "border border-border-muted bg-surface p-3";
const ROW_DISABLED_CLASSES = "opacity-60";
const HEADER_CLASSES = "mb-2";
const LABEL_CLASSES = "flex cursor-pointer items-center gap-2";
const NAME_CLASSES = "font-medium text-foreground";
const PATH_CLASSES = "flex items-center gap-2";
const PATH_INPUT_CLASSES =
	"flex-1 border border-border bg-surface-muted px-2 py-[6px] font-mono text-[0.85rem] text-foreground outline-none focus:border-accent disabled:opacity-50";
const RESET_LINK_CLASSES =
	"cursor-pointer whitespace-nowrap appearance-none border-0 bg-transparent p-0 text-[0.85rem] text-accent hover:underline disabled:cursor-default disabled:opacity-50";
const BROWSE_BTN_CLASSES =
	"inline-flex h-7 cursor-pointer items-center gap-[6px] border border-border bg-surface px-2 py-1 text-[0.8rem] text-foreground transition-colors duration-150 enabled:hover:border-foreground-subtle enabled:hover:bg-surface-muted disabled:cursor-default disabled:opacity-50";

function PluginRow({
	plugin,
	onToggle,
	onBrowse,
	onPathChange,
	onReset,
	canBrowse = true,
}: PluginRowProps): React.ReactNode {
	const customPath = plugin.isCustomDir ? plugin.dataDir : "";
	const [editingPath, setEditingPath] = useState(customPath);
	const displayName = plugin.status === "beta" ? `${plugin.displayName} (beta)` : plugin.displayName;

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
		<div className={`${ROW_BASE_CLASSES} ${plugin.enabled ? "" : ROW_DISABLED_CLASSES}`}>
			<div className={HEADER_CLASSES}>
				<label className={LABEL_CLASSES}>
					<input type="checkbox" className="custom-checkbox" checked={plugin.enabled} onChange={handleToggle} />
					<span className={NAME_CLASSES}>{displayName}</span>
				</label>
			</div>
			<div className={PATH_CLASSES}>
				<input
					type="text"
					className={PATH_INPUT_CLASSES}
					value={editingPath}
					placeholder={plugin.defaultDataDir}
					onChange={handlePathInputChange}
					onBlur={commitPath}
					onKeyDown={handlePathKeyDown}
					disabled={!plugin.enabled}
				/>
				{canBrowse ? (
					<button type="button" className={BROWSE_BTN_CLASSES} onClick={handleBrowse} disabled={!plugin.enabled}>
						<Text>{T_BROWSE}</Text>
					</button>
				) : null}
				{plugin.isCustomDir ? (
					<button type="button" className={RESET_LINK_CLASSES} onClick={handleReset} disabled={!plugin.enabled}>
						<Text>{T_RESET}</Text>
					</button>
				) : null}
			</div>
		</div>
	);
}

export type { PluginRowProps } from "./PluginRow.types";
export { PluginRow };
