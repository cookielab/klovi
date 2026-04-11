import { Effect } from "effect";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKloviClient, useKloviHostBridge, useRunKloviEffect } from "../../../lib/context.ts";
import { kloviHostBridge } from "../../../lib/rpc-client.ts";
import type { PluginSettingInfo, UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../../../shared/rpc-types.ts";
import type { ThemeSetting } from "../../hooks/useTheme.ts";
import { PluginRow } from "./PluginRow.tsx";
import type { SettingsTab } from "./SettingsSidebar.tsx";

type ThemeProps = {
	setting: ThemeSetting;
	set: (theme: ThemeSetting) => void;
};

type FontSizeProps = {
	size: number;
	set: (size: number) => void;
	increase: () => void;
	decrease: () => void;
};

type PresentationThemeProps = {
	setting: ThemeSetting;
	sameAsGlobal: boolean;
	setSameAsGlobal: (v: boolean) => void;
	set: (theme: ThemeSetting) => void;
};

type PresentationFontSizeProps = {
	size: number;
	sameAsGlobal: boolean;
	setSameAsGlobal: (v: boolean) => void;
	set: (size: number) => void;
	increase: () => void;
	decrease: () => void;
};

type SettingsViewProps = {
	activeTab: SettingsTab;
	onNavigateHome: () => void;
	theme: ThemeProps;
	fontSize: FontSizeProps;
	presentationTheme: PresentationThemeProps;
	presentationFontSize: PresentationFontSizeProps;
};

const VIEW_CLASSES = "flex flex-1 flex-col overflow-hidden";
const CONTENT_CLASSES = "max-w-[800px] flex-1 overflow-y-auto px-8 py-6";
const SECTION_TITLE_CLASSES = "mx-0 mt-0 mb-4 text-[0.95rem] font-semibold text-foreground";
const SUBSECTION_TITLE_CLASSES =
	"mx-0 mt-5 mb-3 text-[0.85rem] font-semibold uppercase tracking-[0.03em] text-foreground-subtle";
const LOADING_CLASSES = "px-0 py-5 text-foreground-muted";
const PLUGIN_LIST_CLASSES = "flex flex-col gap-4";
const CONTROL_ROW_CLASSES = "flex min-h-9 items-start gap-3 px-3 py-2";
const CONTROL_LABEL_CLASSES = "min-w-20 pt-[6px] text-[0.9rem] font-medium text-foreground";
const CONTROL_GROUP_CLASSES = "flex flex-col gap-[6px]";
const GENERAL_HINT_CLASSES = "m-0 pl-[22px] text-[0.8rem] text-foreground-muted";
const SAME_AS_GLOBAL_CLASSES = "flex cursor-pointer items-center gap-[6px] text-[0.85rem] text-foreground-subtle";
const THEME_SELECTOR_BASE_CLASSES = "settings-theme-selector inline-flex overflow-hidden border border-border";
const THEME_SELECTOR_DISABLED_CLASSES = "disabled pointer-events-none opacity-50";
const THEME_OPTION_BASE_CLASSES =
	"cursor-pointer border-0 border-border border-r bg-surface px-[14px] py-[5px] text-[0.85rem] text-foreground-subtle last:border-r-0 enabled:hover:bg-surface-muted disabled:cursor-default";
const THEME_OPTION_ACTIVE_CLASSES = "bg-accent-subtle font-medium text-accent";
const FONT_SIZE_CONTROL_BASE_CLASSES = "settings-font-size-control inline-flex items-center gap-2";
const FONT_SIZE_CONTROL_DISABLED_CLASSES = "disabled pointer-events-none opacity-50";
const FONT_SIZE_BUTTON_CLASSES =
	"cursor-pointer border border-border bg-surface px-[10px] py-1 text-[0.85rem] text-foreground-subtle enabled:hover:bg-surface-muted disabled:cursor-default disabled:opacity-40";
const FONT_SIZE_VALUE_CLASSES = "min-w-7 text-center text-[0.9rem] font-medium text-foreground";
const SELECT_CLASSES =
	"cursor-pointer border border-border bg-surface px-[10px] py-[5px] text-[0.85rem] text-foreground outline-none focus:border-accent";
const UPDATE_STATUS_ROW_CLASSES = "flex items-center gap-2";
const UPDATE_STATUS_CLASSES = "text-[0.9rem] text-foreground-subtle";
const UPDATE_APPLY_BTN_CLASSES =
	"cursor-pointer border-0 bg-accent px-3 py-1 text-[0.8rem] text-white enabled:hover:opacity-90 disabled:cursor-default disabled:opacity-60";
const RESET_TO_DEFAULTS_BTN_CLASSES =
	"cursor-pointer border border-border bg-surface px-[14px] py-[6px] text-[0.85rem] text-foreground-subtle enabled:hover:bg-surface-muted disabled:cursor-default disabled:opacity-50";
const RESET_CONFIRM_TEXT_CLASSES = "mx-0 mt-0 mb-2 text-[0.85rem] font-medium text-foreground";
const RESET_CONFIRM_ACTIONS_CLASSES = "flex gap-2";
const RESET_CONFIRM_BTN_CLASSES =
	"cursor-pointer border border-transparent bg-error px-[14px] py-[6px] text-[0.85rem] text-white enabled:hover:opacity-90 disabled:cursor-default disabled:opacity-50";
const RESET_CANCEL_BTN_CLASSES =
	"cursor-pointer border border-border bg-surface px-[14px] py-[6px] text-[0.85rem] text-foreground-subtle enabled:hover:bg-surface-muted disabled:cursor-default";

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

function ThemeOption({
	opt,
	isActive,
	disabled,
	onChange,
}: {
	opt: { value: ThemeSetting; label: string };
	isActive: boolean;
	disabled: boolean | undefined;
	onChange: (v: ThemeSetting) => void;
}) {
	const handleClick = useCallback(() => onChange(opt.value), [onChange, opt.value]);
	return (
		<button
			type="button"
			className={`${THEME_OPTION_BASE_CLASSES} ${isActive ? `active ${THEME_OPTION_ACTIVE_CLASSES}` : ""}`}
			disabled={disabled}
			onClick={handleClick}
		>
			{opt.label}
		</button>
	);
}

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
		<div className={`${THEME_SELECTOR_BASE_CLASSES} ${disabled ? THEME_SELECTOR_DISABLED_CLASSES : ""}`}>
			{THEME_OPTIONS.map((opt) => (
				<ThemeOption key={opt.value} opt={opt} isActive={value === opt.value} disabled={disabled} onChange={onChange} />
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
		<div className={`${FONT_SIZE_CONTROL_BASE_CLASSES} ${disabled ? FONT_SIZE_CONTROL_DISABLED_CLASSES : ""}`}>
			{/* biome-ignore lint/nursery/useNullishCoalescing: disabled is boolean|undefined, || intentionally treats false as falsy */}
			<button type="button" className={FONT_SIZE_BUTTON_CLASSES} disabled={disabled || size <= 10} onClick={onDecrease}>
				A-
			</button>
			<span className={FONT_SIZE_VALUE_CLASSES}>{size}</span>
			{/* biome-ignore lint/nursery/useNullishCoalescing: disabled is boolean|undefined, || intentionally treats false as falsy */}
			<button type="button" className={FONT_SIZE_BUTTON_CLASSES} disabled={disabled || size >= 28} onClick={onIncrease}>
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
	const runKloviEffect = useRunKloviEffect();
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
	const [checking, setChecking] = useState(false);
	const [applying, setApplying] = useState(false);
	const [applyError, setApplyError] = useState<string | null>(null);

	const statusText = applyError ? `Update failed: ${applyError}` : formatUpdateStatus(updateStatus);

	const handleApply = useCallback(async () => {
		setApplying(true);
		setApplyError(null);
		try {
			const result = await runKloviEffect(kloviHostBridge.applyUpdate());
			if (!result.ok) {
				setApplyError(result.error ?? "Update failed");
				setApplying(false);
			}
		} catch {
			setApplyError("Update failed");
			setApplying(false);
		}
	}, [runKloviEffect]);

	const handleChannelChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const channel = e.target.value as UpdateChannel;
			setUpdateSettings({ ...updateSettings!, channel: channel });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ channel: channel }))
				.then(() => setChanged(true))
				.catch(() => {});
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleIntervalChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const checkIntervalHours = Number(e.target.value);
			setUpdateSettings({ ...updateSettings!, checkIntervalHours: checkIntervalHours });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ checkIntervalHours: checkIntervalHours }))
				.then(() => setChanged(true))
				.catch(() => {});
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleAutoDownloadChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const autoDownload = e.target.checked;
			setUpdateSettings({ ...updateSettings!, autoDownload: autoDownload });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ autoDownload: autoDownload }))
				.then(() => setChanged(true))
				.catch(() => {});
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleCheckNow = useCallback(() => {
		setChecking(true);
		setApplyError(null);
		runKloviEffect(kloviHostBridge.checkForUpdate())
			.then((result) => setUpdateStatus(result))
			.catch(() => {})
			.finally(() => setChecking(false));
	}, [runKloviEffect]);

	return (
		<>
			<h4 className={SUBSECTION_TITLE_CLASSES}>Updates</h4>
			{loading ? (
				<div className={LOADING_CLASSES}>Loading...</div>
			) : (
				updateSettings && (
					<>
						<div className={CONTROL_ROW_CLASSES}>
							<span className={CONTROL_LABEL_CLASSES}>Update Channel</span>
							<select className={SELECT_CLASSES} value={updateSettings.channel} onChange={handleChannelChange}>
								<option value="stable">Stable</option>
								<option value="candidate">Release Candidate</option>
								<option value="beta">Beta</option>
							</select>
						</div>

						<div className={CONTROL_ROW_CLASSES}>
							<span className={CONTROL_LABEL_CLASSES}>Check Interval</span>
							<select
								className={SELECT_CLASSES}
								value={updateSettings.checkIntervalHours}
								onChange={handleIntervalChange}
							>
								<option value={1}>Every hour</option>
								<option value={3}>Every 3 hours</option>
								<option value={6}>Every 6 hours</option>
								<option value={12}>Every 12 hours</option>
								<option value={24}>Every 24 hours</option>
							</select>
						</div>

						<div className={CONTROL_ROW_CLASSES}>
							<div className={CONTROL_GROUP_CLASSES}>
								<label className={SAME_AS_GLOBAL_CLASSES}>
									<input
										type="checkbox"
										className="custom-checkbox"
										checked={updateSettings.autoDownload}
										onChange={handleAutoDownloadChange}
									/>
									Auto-download updates
								</label>
								<p className={GENERAL_HINT_CLASSES}>
									When enabled, updates are downloaded in the background automatically.
								</p>
							</div>
						</div>

						<div className={CONTROL_ROW_CLASSES}>
							<div className={UPDATE_STATUS_ROW_CLASSES}>
								<span className={UPDATE_STATUS_CLASSES}>{statusText}</span>
								<button
									type="button"
									className={RESET_TO_DEFAULTS_BTN_CLASSES}
									disabled={checking}
									onClick={handleCheckNow}
								>
									{checking ? "Checking..." : "Check now"}
								</button>
								{updateStatus?.status === "ready" && (
									<button type="button" className={UPDATE_APPLY_BTN_CLASSES} disabled={applying} onClick={handleApply}>
										{applying ? "Restarting…" : "Restart to update"}
									</button>
								)}
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
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const runKloviEffect = useRunKloviEffect();
	const capabilities = hostBridge.getCapabilities();
	const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [_changed, setChanged] = useState(false);
	const [showSecurityWarning, setShowSecurityWarning] = useState(true);
	const [resetting, setResetting] = useState(false);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const resettingRef = useRef(false);
	const [updateSettings, setUpdateSettings] = useState<UpdateSettingsInfo | null>(null);

	useEffect(() => {
		runKloviEffect(
			Effect.all([
				client.getPluginSettings(),
				client.getGeneralSettings(),
				capabilities.updater ? kloviHostBridge.getUpdateSettings() : Effect.succeed(null),
			]),
		)
			.then(([pluginData, generalData, updateData]) => {
				setPlugins(pluginData.plugins);
				setShowSecurityWarning(generalData.showSecurityWarning);
				if (updateData) {
					setUpdateSettings(updateData);
				}
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [capabilities.updater, client, runKloviEffect]);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				onNavigateHome();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onNavigateHome]);

	const handleToggle = useCallback(
		(pluginId: string, enabled: boolean) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, enabled: enabled }))
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handleBrowse = useCallback(
		async (pluginId: string, currentDir: string) => {
			try {
				const data = await runKloviEffect(kloviHostBridge.browseDirectory({ startingFolder: currentDir }));
				if (!data.path) {
					return;
				}
				const updated = await runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, dataDir: data.path }));
				setPlugins(updated.plugins);
				setChanged(true);
			} catch {}
		},
		[client, runKloviEffect],
	);

	const handlePathChange = useCallback(
		(pluginId: string, dataDir: string) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, dataDir: dataDir }))
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handleReset = useCallback(
		(pluginId: string) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, dataDir: null }))
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handleSecurityWarningChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.checked;
			setShowSecurityWarning(value);
			runKloviEffect(client.updateGeneralSettings({ showSecurityWarning: value }))
				.then(() => setChanged(true))
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handlePresentationThemeSameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => presentationTheme.setSameAsGlobal(e.target.checked),
		[presentationTheme],
	);

	const handlePresentationFontSizeSameChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => presentationFontSize.setSameAsGlobal(e.target.checked),
		[presentationFontSize],
	);

	const cancelReset = useCallback(() => setConfirmingReset(false), []);
	const startReset = useCallback(() => setConfirmingReset(true), []);

	const handleResetToDefaults = useCallback(() => {
		if (resettingRef.current) {
			return;
		}
		resettingRef.current = true;
		setResetting(true);
		runKloviEffect(client.resetSettings())
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
	}, [client, runKloviEffect]);

	return (
		<div className={VIEW_CLASSES}>
			<div className={CONTENT_CLASSES}>
				{activeTab === "plugins" && (
					<>
						<h3 className={SECTION_TITLE_CLASSES}>Plugins</h3>
						{loading ? (
							<div className={LOADING_CLASSES}>Loading...</div>
						) : (
							<div className={PLUGIN_LIST_CLASSES}>
								{plugins.map((plugin) => (
									<PluginRow
										key={plugin.id}
										plugin={plugin}
										onToggle={handleToggle}
										onBrowse={handleBrowse}
										onPathChange={handlePathChange}
										onReset={handleReset}
										canBrowse={capabilities.browseDirectory}
									/>
								))}
							</div>
						)}
					</>
				)}
				{activeTab === "general" && (
					<>
						<h3 className={SECTION_TITLE_CLASSES}>General</h3>
						{loading ? (
							<div className={LOADING_CLASSES}>Loading...</div>
						) : (
							<>
								<div className={CONTROL_ROW_CLASSES}>
									<div className={CONTROL_GROUP_CLASSES}>
										<label className={SAME_AS_GLOBAL_CLASSES}>
											<input
												type="checkbox"
												className="custom-checkbox"
												checked={showSecurityWarning}
												onChange={handleSecurityWarningChange}
											/>
											Show security warning on startup
										</label>
										<p className={GENERAL_HINT_CLASSES}>
											When enabled, the security warning is shown each time Klovi launches.
										</p>
									</div>
								</div>

								<h4 className={SUBSECTION_TITLE_CLASSES}>Global</h4>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}>Theme</span>
									<ThemeSelector value={theme.setting} onChange={theme.set} />
								</div>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}>Font Size</span>
									<FontSizeControl size={fontSize.size} onIncrease={fontSize.increase} onDecrease={fontSize.decrease} />
								</div>

								<h4 className={SUBSECTION_TITLE_CLASSES}>Presentation</h4>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}>Theme</span>
									<div className={CONTROL_GROUP_CLASSES}>
										<label className={SAME_AS_GLOBAL_CLASSES}>
											<input
												type="checkbox"
												className="custom-checkbox"
												checked={presentationTheme.sameAsGlobal}
												onChange={handlePresentationThemeSameChange}
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

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}>Font Size</span>
									<div className={CONTROL_GROUP_CLASSES}>
										<label className={SAME_AS_GLOBAL_CLASSES}>
											<input
												type="checkbox"
												className="custom-checkbox"
												checked={presentationFontSize.sameAsGlobal}
												onChange={handlePresentationFontSizeSameChange}
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

								{capabilities.updater ? (
									<UpdatesTab
										loading={false}
										updateSettings={updateSettings}
										setUpdateSettings={setUpdateSettings}
										setChanged={setChanged}
									/>
								) : null}

								<h4 className={SUBSECTION_TITLE_CLASSES}>Reset</h4>
								<div className={CONTROL_ROW_CLASSES}>
									{confirmingReset ? (
										<div className={CONTROL_GROUP_CLASSES}>
											<p className={RESET_CONFIRM_TEXT_CLASSES}>
												Reset all settings to defaults? This cannot be undone.
											</p>
											<div className={RESET_CONFIRM_ACTIONS_CLASSES}>
												<button
													type="button"
													className={RESET_CONFIRM_BTN_CLASSES}
													disabled={resetting}
													onClick={handleResetToDefaults}
												>
													{resetting ? "Resetting..." : "Yes, reset everything"}
												</button>
												<button
													type="button"
													className={RESET_CANCEL_BTN_CLASSES}
													disabled={resetting}
													onClick={cancelReset}
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<div className={CONTROL_GROUP_CLASSES}>
											<button
												type="button"
												className={RESET_TO_DEFAULTS_BTN_CLASSES}
												disabled={resetting}
												onClick={startReset}
											>
												Reset to defaults
											</button>
											<p className={GENERAL_HINT_CLASSES}>Deletes all settings and returns to the home screen.</p>
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
