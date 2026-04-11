import { useCallback, useEffect, useState } from "react";
import { useKloviClient, useKloviHostBridge, useRunKloviEffect } from "../../../lib/context.ts";
import { kloviHostBridge } from "../../../lib/rpc-client.ts";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { PluginRow } from "../settings/PluginRow.tsx";
import { SecurityNoticeContent } from "./SecurityWarning.tsx";

const WRAPPER_CLASSES = "flex min-h-screen items-center justify-center bg-surface p-[20px]";
const CONTENT_CLASSES = "w-full max-w-[480px] text-center leading-[1.6] text-foreground-muted";
const STEPS_CLASSES = "mb-[24px] flex items-center justify-center gap-[8px]";
const DOT_BASE_CLASSES = "onboarding-dot size-[8px] rounded-full transition-[background] duration-200";
const DOT_INACTIVE_CLASSES = "bg-border";
const DOT_ACTIVE_CLASSES = "bg-accent";
const LINE_CLASSES = "h-[2px] w-[24px] bg-border";
const HEADING_CLASSES = "mb-[16px] text-[1.3rem] font-semibold text-foreground";
const SUBTITLE_CLASSES = "mb-[16px] text-[0.9rem] text-foreground-subtle";
const PLUGINS_CLASSES = "mb-[24px] flex flex-col gap-[16px] text-left";
const BUTTON_CLASSES =
	"mt-[24px] cursor-pointer border-0 bg-accent px-[32px] py-[10px] font-sans text-[0.95rem] font-medium text-foreground-inverse transition-[background] duration-150 hover:bg-accent-hover";
const BACK_CLASSES =
	"mx-auto mt-[12px] block cursor-pointer border-0 bg-transparent px-[16px] py-[6px] font-sans text-[0.85rem] text-foreground-subtle hover:text-foreground";

type OnboardingProps = {
	onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const runKloviEffect = useRunKloviEffect();
	const capabilities = hostBridge.getCapabilities();
	const [step, setStep] = useState<1 | 2>(1);
	const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		runKloviEffect(client.getPluginSettings())
			.then((data) => {
				setPlugins(data.plugins);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, [client, runKloviEffect]);

	const handleToggle = useCallback(
		(pluginId: string, enabled: boolean) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, enabled: enabled }))
				.then((data) => setPlugins(data.plugins))
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
			} catch {}
		},
		[client, runKloviEffect],
	);

	const handlePathChange = useCallback(
		(pluginId: string, dataDir: string) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, dataDir: dataDir }))
				.then((data) => setPlugins(data.plugins))
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handleReset = useCallback(
		(pluginId: string) => {
			runKloviEffect(client.updatePluginSetting({ pluginId: pluginId, dataDir: null }))
				.then((data) => setPlugins(data.plugins))
				.catch(() => {});
		},
		[client, runKloviEffect],
	);

	const handleAcceptStep1 = useCallback(() => setStep(2), []);
	const handleDontShowAgain = useCallback(() => {
		void runKloviEffect(client.updateGeneralSettings({ showSecurityWarning: false })).catch(() => {});
	}, [client, runKloviEffect]);
	const handleBackToStep1 = useCallback(() => setStep(1), []);

	return (
		<section className={WRAPPER_CLASSES} aria-labelledby="onboarding-heading">
			<div className={CONTENT_CLASSES}>
				<div className={STEPS_CLASSES} aria-hidden="true">
					<div className={`${DOT_BASE_CLASSES} ${step === 1 ? DOT_ACTIVE_CLASSES : DOT_INACTIVE_CLASSES}`} />
					<div className={LINE_CLASSES} />
					<div className={`${DOT_BASE_CLASSES} ${step === 2 ? DOT_ACTIVE_CLASSES : DOT_INACTIVE_CLASSES}`} />
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
						<h1 id="onboarding-heading" className={HEADING_CLASSES}>
							Plugins
						</h1>
						<p className={SUBTITLE_CLASSES}>Choose which AI coding tools to monitor</p>
						{loading ? (
							<div>Loading...</div>
						) : (
							<div className={PLUGINS_CLASSES}>
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
						<button type="button" className={BUTTON_CLASSES} onClick={onComplete}>
							Get Started
						</button>
						<button type="button" className={BACK_CLASSES} onClick={handleBackToStep1}>
							Back
						</button>
					</>
				)}
			</div>
		</section>
	);
}
