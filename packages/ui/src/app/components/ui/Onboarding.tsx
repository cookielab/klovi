import { useCallback, useEffect, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../../lib/context.ts";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { PluginRow } from "../settings/PluginRow.tsx";
import "./Onboarding.css";
import { SecurityNoticeContent } from "./SecurityWarning.tsx";

type OnboardingProps = {
	onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const capabilities = hostBridge.getCapabilities();
	const [step, setStep] = useState<1 | 2>(1);
	const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		client
			.getPluginSettings()
			.then((data) => {
				setPlugins(data.plugins);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [client]);

	const handleToggle = useCallback(
		(pluginId: string, enabled: boolean) => {
			client
				.updatePluginSetting({ pluginId: pluginId, enabled: enabled })
				.then((data) => setPlugins(data.plugins))
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
				.then((data) => setPlugins(data.plugins))
				.catch(() => {});
		},
		[client],
	);

	const handleReset = useCallback(
		(pluginId: string) => {
			client
				.updatePluginSetting({ pluginId: pluginId, dataDir: null })
				.then((data) => setPlugins(data.plugins))
				.catch(() => {});
		},
		[client],
	);

	const handleAcceptStep1 = useCallback(() => setStep(2), []);
	const handleDontShowAgain = useCallback(() => {
		client.updateGeneralSettings({ showSecurityWarning: false }).catch(() => {});
	}, [client]);
	const handleBackToStep1 = useCallback(() => setStep(1), []);

	return (
		<section className="onboarding" aria-labelledby="onboarding-heading">
			<div className="onboarding-content">
				<div className="onboarding-steps" aria-hidden="true">
					<div className={`onboarding-dot ${step === 1 ? "active" : ""}`} />
					<div className="onboarding-line" />
					<div className={`onboarding-dot ${step === 2 ? "active" : ""}`} />
				</div>

				{step === 1 && (
					<SecurityNoticeContent
						headingId="onboarding-heading"
						onAccept={handleAcceptStep1}
						onDontShowAgain={handleDontShowAgain}
					/>
				)}

				{step === 2 && (
					<>
						{/* biome-ignore lint/correctness/useUniqueElementIds: only one step renders at a time, no duplicate */}
						<h1 id="onboarding-heading" className="onboarding-heading">
							Plugins
						</h1>
						<p className="onboarding-subtitle">Choose which AI coding tools to monitor</p>
						{loading ? (
							<div>Loading...</div>
						) : (
							<div className="onboarding-plugins">
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
						<button type="button" className="onboarding-button" onClick={onComplete}>
							Get Started
						</button>
						<button type="button" className="onboarding-back" onClick={handleBackToStep1}>
							Back
						</button>
					</>
				)}
			</div>
		</section>
	);
}
