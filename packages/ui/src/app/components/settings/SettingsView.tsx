import { Text } from "@cookielab.io/klovi-design-system";
import { Effect } from "effect";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKloviClient, useKloviHostBridge, useRunKloviEffect } from "../../../lib/context";
import { kloviHostBridge } from "../../../lib/rpc-client";
import type { PluginSettingInfo, UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../../../shared/rpc-types";
import type { ThemeSetting } from "../../hooks/useTheme";
import { PluginRow } from "./PluginRow";
import type { SettingsTab } from "./SettingsSidebar";


const T_A = "A-";
const T_A_2 = "A+";
const T_UPDATES = "Updates";
const T_LOADING = "Loading...";
const T_UPDATE_CHANNEL = "Update Channel";
const T_STABLE = "Stable";
const T_RELEASE_CANDIDATE = "Release Candidate";
const T_BETA = "Beta";
const T_CHECK_INTERVAL = "Check Interval";
const T_EVERY_HOUR = "Every hour";
const T_EVERY_3_HOURS = "Every 3 hours";
const T_EVERY_6_HOURS = "Every 6 hours";
const T_EVERY_12_HOURS = "Every 12 hours";
const T_EVERY_24_HOURS = "Every 24 hours";
const T_AUTO_DOWNLOAD_UPDATES = "Auto-download updates";
const T_WHEN_ENABLED_UPDATES_ARE_DOWNL = "When enabled, updates are downloaded in the background automatically.";
const T_PLUGINS = "Plugins";
const T_GENERAL = "General";
const T_SHOW_SECURITY_WARNING_ON_START = "Show security warning on startup";
const T_WHEN_ENABLED_THE_SECURITY_WARN = "When enabled, the security warning is shown each time Klovi launches.";
const T_GLOBAL = "Global";
const T_THEME = "Theme";
const T_FONT_SIZE = "Font Size";
const T_PRESENTATION = "Presentation";
const T_SAME_AS_GLOBAL = "Same as global";
const T_RESET = "Reset";
const T_RESET_ALL_SETTINGS_TO_DEFAULTS = "Reset all settings to defaults? This cannot be undone.";
const T_CANCEL = "Cancel";
const T_RESET_TO_DEFAULTS = "Reset to defaults";
const T_DELETES_ALL_SETTINGS_AND_RETUR = "Deletes all settings and returns to the home screen.";

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
}): React.ReactNode {
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
}): React.ReactNode {
	return (
		<div className={`${THEME_SELECTOR_BASE_CLASSES} ${disabled ? THEME_SELECTOR_DISABLED_CLASSES : ""}`}>
			{THEME_OPTIONS.map((opt) => (
				<ThemeOption key={opt.value} opt={opt} isActive={value === opt.value} disabled={disabled} onChange={onChange} />
			))}
		</div>
	);
}

const MAX_FONT_SIZE = 28;

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
}): React.ReactNode {
	return (
		<div className={`${FONT_SIZE_CONTROL_BASE_CLASSES} ${disabled ? FONT_SIZE_CONTROL_DISABLED_CLASSES : ""}`}>
			<button type="button" className={FONT_SIZE_BUTTON_CLASSES} disabled={disabled || size <= 10} onClick={onDecrease}>
				<Text>{T_A}</Text>
			</button>
			<span className={FONT_SIZE_VALUE_CLASSES}>{size}</span>
			<button
				type="button"
				className={FONT_SIZE_BUTTON_CLASSES}
				disabled={disabled || size >= MAX_FONT_SIZE}
				onClick={onIncrease}
			>
				<Text>{T_A_2}</Text>
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
}): React.ReactNode {
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
			if (!updateSettings) {
				return;
			}
			setUpdateSettings({ ...updateSettings, channel: channel });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ channel: channel }))
				.then(() => setChanged(true))
				.catch(() => undefined);
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleIntervalChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const checkIntervalHours = Number(e.target.value);
			if (!updateSettings) {
				return;
			}
			setUpdateSettings({ ...updateSettings, checkIntervalHours: checkIntervalHours });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ checkIntervalHours: checkIntervalHours }))
				.then(() => setChanged(true))
				.catch(() => undefined);
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleAutoDownloadChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const autoDownload = e.target.checked;
			if (!updateSettings) {
				return;
			}
			setUpdateSettings({ ...updateSettings, autoDownload: autoDownload });
			runKloviEffect(kloviHostBridge.updateUpdateSettings({ autoDownload: autoDownload }))
				.then(() => setChanged(true))
				.catch(() => undefined);
		},
		[runKloviEffect, updateSettings, setUpdateSettings, setChanged],
	);

	const handleCheckNow = useCallback(() => {
		setChecking(true);
		setApplyError(null);
		runKloviEffect(kloviHostBridge.checkForUpdate())
			.then((result) => setUpdateStatus(result))
			.catch(() => undefined)
			.finally(() => setChecking(false));
	}, [runKloviEffect]);

	return (
		<>
			<h4 className={SUBSECTION_TITLE_CLASSES}><Text>{T_UPDATES}</Text></h4>
			{loading ? (
				<div className={LOADING_CLASSES}><Text>{T_LOADING}</Text></div>
			) : (
				updateSettings && (
					<>
						<div className={CONTROL_ROW_CLASSES}>
							<span className={CONTROL_LABEL_CLASSES}><Text>{T_UPDATE_CHANNEL}</Text></span>
							<select className={SELECT_CLASSES} value={updateSettings.channel} onChange={handleChannelChange}>
								<option value="stable"><Text>{T_STABLE}</Text></option>
								<option value="candidate"><Text>{T_RELEASE_CANDIDATE}</Text></option>
								<option value="beta"><Text>{T_BETA}</Text></option>
							</select>
						</div>

						<div className={CONTROL_ROW_CLASSES}>
							<span className={CONTROL_LABEL_CLASSES}><Text>{T_CHECK_INTERVAL}</Text></span>
							<select
								className={SELECT_CLASSES}
								value={updateSettings.checkIntervalHours}
								onChange={handleIntervalChange}
							>
								<option value={1}><Text>{T_EVERY_HOUR}</Text></option>
								<option value={3}><Text>{T_EVERY_3_HOURS}</Text></option>
								<option value={6}><Text>{T_EVERY_6_HOURS}</Text></option>
								<option value={12}><Text>{T_EVERY_12_HOURS}</Text></option>
								<option value={24}><Text>{T_EVERY_24_HOURS}</Text></option>
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
									<Text>{T_AUTO_DOWNLOAD_UPDATES}</Text>
								</label>
								<p className={GENERAL_HINT_CLASSES}>
									<Text>{T_WHEN_ENABLED_UPDATES_ARE_DOWNL}</Text>
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
}: SettingsViewProps): React.ReactNode {
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
		function handleKeyDown(e: KeyboardEvent): void {
			if (e.key === "Escape") {
				e.preventDefault();
				onNavigateHome();
			}
		}
		globalThis.addEventListener("keydown", handleKeyDown);
		return () => globalThis.removeEventListener("keydown", handleKeyDown);
	}, [onNavigateHome]);

	const handleToggle = useCallback(
		(pluginId: string, enabled: boolean) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, enabled: enabled }))
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => undefined);
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
			} catch {
				// swallow browseDirectory errors (e.g. user cancelled)
			}
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
				.catch(() => undefined);
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
				.catch(() => undefined);
		},
		[client, runKloviEffect],
	);

	const handleSecurityWarningChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.checked;
			setShowSecurityWarning(value);
			runKloviEffect(client.updateGeneralSettings({ showSecurityWarning: value }))
				.then(() => setChanged(true))
				.catch(() => undefined);
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
				globalThis.dispatchEvent(new CustomEvent("klovi:reset"));
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
						<h3 className={SECTION_TITLE_CLASSES}><Text>{T_PLUGINS}</Text></h3>
						{loading ? (
							<div className={LOADING_CLASSES}><Text>{T_LOADING}</Text></div>
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
						<h3 className={SECTION_TITLE_CLASSES}><Text>{T_GENERAL}</Text></h3>
						{loading ? (
							<div className={LOADING_CLASSES}><Text>{T_LOADING}</Text></div>
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
											<Text>{T_SHOW_SECURITY_WARNING_ON_START}</Text>
										</label>
										<p className={GENERAL_HINT_CLASSES}>
											<Text>{T_WHEN_ENABLED_THE_SECURITY_WARN}</Text>
										</p>
									</div>
								</div>

								<h4 className={SUBSECTION_TITLE_CLASSES}><Text>{T_GLOBAL}</Text></h4>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}><Text>{T_THEME}</Text></span>
									<ThemeSelector value={theme.setting} onChange={theme.set} />
								</div>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}><Text>{T_FONT_SIZE}</Text></span>
									<FontSizeControl size={fontSize.size} onIncrease={fontSize.increase} onDecrease={fontSize.decrease} />
								</div>

								<h4 className={SUBSECTION_TITLE_CLASSES}><Text>{T_PRESENTATION}</Text></h4>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}><Text>{T_THEME}</Text></span>
									<div className={CONTROL_GROUP_CLASSES}>
										<label className={SAME_AS_GLOBAL_CLASSES}>
											<input
												type="checkbox"
												className="custom-checkbox"
												checked={presentationTheme.sameAsGlobal}
												onChange={handlePresentationThemeSameChange}
											/>
											<Text>{T_SAME_AS_GLOBAL}</Text>
										</label>
										<ThemeSelector
											value={presentationTheme.setting}
											onChange={presentationTheme.set}
											disabled={presentationTheme.sameAsGlobal}
										/>
									</div>
								</div>

								<div className={CONTROL_ROW_CLASSES}>
									<span className={CONTROL_LABEL_CLASSES}><Text>{T_FONT_SIZE}</Text></span>
									<div className={CONTROL_GROUP_CLASSES}>
										<label className={SAME_AS_GLOBAL_CLASSES}>
											<input
												type="checkbox"
												className="custom-checkbox"
												checked={presentationFontSize.sameAsGlobal}
												onChange={handlePresentationFontSizeSameChange}
											/>
											<Text>{T_SAME_AS_GLOBAL}</Text>
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

								<h4 className={SUBSECTION_TITLE_CLASSES}><Text>{T_RESET}</Text></h4>
								<div className={CONTROL_ROW_CLASSES}>
									{confirmingReset ? (
										<div className={CONTROL_GROUP_CLASSES}>
											<p className={RESET_CONFIRM_TEXT_CLASSES}>
												<Text>{T_RESET_ALL_SETTINGS_TO_DEFAULTS}</Text>
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
													<Text>{T_CANCEL}</Text>
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
												<Text>{T_RESET_TO_DEFAULTS}</Text>
											</button>
											<p className={GENERAL_HINT_CLASSES}><Text>{T_DELETES_ALL_SETTINGS_AND_RETUR}</Text></p>
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
