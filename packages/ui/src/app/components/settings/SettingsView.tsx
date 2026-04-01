import { useCallback, useEffect, useRef, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context.ts";
import type { PluginSettingInfo, UpdateChannel, UpdateSettingsInfo, UpdateStatus } from "../../../shared/rpc-types.ts";
import type { ThemeSetting } from "../../hooks/useTheme.ts";
import { PluginRow } from "./PluginRow.tsx";
import type { SettingsTab } from "./SettingsSidebar.tsx";
import "./SettingsView.css";

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
	const hostBridge = useKloviHostBridge();
	const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
	const [checking, setChecking] = useState(false);
	const [applying, setApplying] = useState(false);
	const [applyError, setApplyError] = useState<string | null>(null);

	const statusText = applyError ? `Update failed: ${applyError}` : formatUpdateStatus(updateStatus);

	const handleApply = async () => {
		setApplying(true);
		setApplyError(null);
		try {
			const result = await hostBridge.applyUpdate();
			if (!result.ok) {
				setApplyError(result.error ?? "Update failed");
				setApplying(false);
			}
		} catch {
			setApplyError("Update failed");
			setApplying(false);
		}
	};

	return (
		<>
			<h4 className="settings-subsection-title">Updates</h4>
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
									setUpdateSettings({ ...updateSettings, channel: channel });
									hostBridge
										.updateUpdateSettings({ channel: channel })
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
									setUpdateSettings({ ...updateSettings, checkIntervalHours: checkIntervalHours });
									hostBridge
										.updateUpdateSettings({ checkIntervalHours: checkIntervalHours })
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
											setUpdateSettings({ ...updateSettings, autoDownload: autoDownload });
											hostBridge
												.updateUpdateSettings({ autoDownload: autoDownload })
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

						<div className="settings-control-row">
							<div className="settings-update-status-row">
								<span className="settings-update-status">{statusText}</span>
								<button
									type="button"
									className="settings-reset-to-defaults-btn"
									disabled={checking}
									onClick={() => {
										setChecking(true);
										setApplyError(null);
										hostBridge
											.checkForUpdate()
											.then((result) => setUpdateStatus(result))
											.catch(() => {})
											.finally(() => setChecking(false));
									}}
								>
									{checking ? "Checking..." : "Check now"}
								</button>
								{updateStatus?.status === "ready" && (
									<button type="button" className="settings-update-apply-btn" disabled={applying} onClick={handleApply}>
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
		const promises: [
			Promise<{ plugins: PluginSettingInfo[] }>,
			Promise<{ showSecurityWarning: boolean }>,
			Promise<UpdateSettingsInfo | null>,
		] = [
			client.getPluginSettings(),
			client.getGeneralSettings(),
			capabilities.updater ? hostBridge.getUpdateSettings() : Promise.resolve(null),
		];
		Promise.all(promises)
			.then(([pluginData, generalData, updateData]) => {
				setPlugins(pluginData.plugins);
				setShowSecurityWarning(generalData.showSecurityWarning);
				if (updateData) {
					setUpdateSettings(updateData);
				}
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [client, hostBridge, capabilities.updater]);

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
			client
				.updatePluginSetting({ pluginId: pluginId, enabled: enabled })
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client],
	);

	const handleBrowse = useCallback(
		(pluginId: string, currentDir: string) => {
			hostBridge
				.browseDirectory({ startingFolder: currentDir })
				.then((data) => {
					if (data.path) {
						return client.updatePluginSetting({ pluginId: pluginId, dataDir: data.path });
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
		},
		[client, hostBridge],
	);

	const handlePathChange = useCallback(
		(pluginId: string, dataDir: string) => {
			client
				.updatePluginSetting({ pluginId: pluginId, dataDir: dataDir })
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client],
	);

	const handleReset = useCallback(
		(pluginId: string) => {
			client
				.updatePluginSetting({ pluginId: pluginId, dataDir: null })
				.then((data) => {
					setPlugins(data.plugins);
					setChanged(true);
				})
				.catch(() => {});
		},
		[client],
	);

	const handleResetToDefaults = useCallback(() => {
		if (resettingRef.current) {
			return;
		}
		resettingRef.current = true;
		setResetting(true);
		client
			.resetSettings()
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
	}, [client]);

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
										canBrowse={capabilities.browseDirectory}
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
													client
														.updateGeneralSettings({ showSecurityWarning: value })
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
									<FontSizeControl size={fontSize.size} onIncrease={fontSize.increase} onDecrease={fontSize.decrease} />
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

								{capabilities.updater && (
									<UpdatesTab
										loading={false}
										updateSettings={updateSettings}
										setUpdateSettings={setUpdateSettings}
										setChanged={setChanged}
									/>
								)}

								<h4 className="settings-subsection-title">Reset</h4>
								<div className="settings-control-row">
									{confirmingReset ? (
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
									) : (
										<div className="settings-control-group">
											<button
												type="button"
												className="settings-reset-to-defaults-btn"
												disabled={resetting}
												onClick={() => setConfirmingReset(true)}
											>
												Reset to defaults
											</button>
											<p className="settings-general-hint">Deletes all settings and returns to the home screen.</p>
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
