import type { ModelTokenUsage, DashboardStats as Stats } from "../types/index.ts";
import { FetchError } from "../utilities/FetchError.tsx";

const fmt = new Intl.NumberFormat();
const CLAUDE_MODEL_NAME_REGEX = /claude-(\w+-[\d-]+?)(?:-\d{8})?$/u;

const DASHBOARD_STATS_CLASSES = "mx-auto flex w-full max-w-[700px] flex-col gap-[12px] px-[40px] pb-[40px]";
const STATS_ROW_CLASSES = "grid gap-[12px]";
const STATS_ROW_3_CLASSES = "grid-cols-3";
const STATS_ROW_4_CLASSES = "grid-cols-4";
const STAT_CARD_CLASSES = "border border-border-muted bg-surface-muted px-[18px] py-[14px]";
const STAT_CARD_SKELETON_CLASSES = "h-[64px] opacity-40";
const STAT_VALUE_CLASSES = "text-[1.3rem] font-bold leading-[1.2] whitespace-nowrap text-foreground";
const STAT_LABEL_CLASSES =
	"mt-[2px] text-[0.7rem] font-semibold uppercase tracking-[0.04em] whitespace-nowrap text-foreground-subtle";
const STAT_SUBLABEL_CLASSES = "mt-[2px] text-[0.68rem] whitespace-nowrap text-foreground-subtle";
const TOKEN_ROW_CLASSES = "mt-[8px]";
const MODEL_LIST_CLASSES = "mt-[6px] mb-0 list-none p-0";
const MODEL_LIST_ITEM_CLASSES = "flex items-center justify-between py-[2px] text-[0.8rem]";
const MODEL_NAME_CLASSES = "font-mono text-[0.78rem] text-foreground-muted";
const MODEL_COUNT_CLASSES = "text-[0.75rem] text-foreground-subtle";

function compactNumber(n: number): string {
	if (n >= 1_000_000_000) {
		return `${(n / 1_000_000_000).toFixed(1)}B`;
	}
	if (n >= 1_000_000) {
		return `${(n / 1_000_000).toFixed(1)}M`;
	}
	if (n >= 1000) {
		return `${(n / 1000).toFixed(1)}K`;
	}
	return String(n);
}

function simplifyModelName(model: string): string {
	const match = CLAUDE_MODEL_NAME_REGEX.exec(model);
	return match?.[1] ?? model;
}

function totalTokens(usage: ModelTokenUsage): number {
	return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
}

export type DashboardStatsProps = {
	stats: Stats | null;
	loading?: boolean | undefined;
	error?: string | undefined;
	onRetry?: (() => void) | undefined;
};

export function DashboardStats({ stats, loading, error, onRetry }: DashboardStatsProps) {
	if (loading) {
		return (
			<div className={DASHBOARD_STATS_CLASSES}>
				<div className={`${STATS_ROW_CLASSES} ${STATS_ROW_3_CLASSES}`}>
					{["skeleton-0", "skeleton-1", "skeleton-2"].map((key) => (
						<div key={key} className={`${STAT_CARD_CLASSES} ${STAT_CARD_SKELETON_CLASSES}`} />
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return <FetchError error={error} {...(onRetry ? { onRetry: onRetry } : {})} />;
	}

	if (!stats) {
		return null;
	}

	const sortedModels = Object.entries(stats.models).sort((a, b) => totalTokens(b[1]) - totalTokens(a[1]));

	return (
		<div className={DASHBOARD_STATS_CLASSES}>
			<div className={`${STATS_ROW_CLASSES} ${STATS_ROW_3_CLASSES}`}>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.projects)}</div>
					<div className={STAT_LABEL_CLASSES}>Projects</div>
				</div>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.sessions)}</div>
					<div className={STAT_LABEL_CLASSES}>Sessions</div>
				</div>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.messages)}</div>
					<div className={STAT_LABEL_CLASSES}>Messages</div>
				</div>
			</div>

			<div className={`${STATS_ROW_CLASSES} ${STATS_ROW_3_CLASSES}`}>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.todaySessions)}</div>
					<div className={STAT_LABEL_CLASSES}>Today Sessions</div>
				</div>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.thisWeekSessions)}</div>
					<div className={STAT_LABEL_CLASSES}>This Week</div>
				</div>
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_VALUE_CLASSES}>{fmt.format(stats.toolCalls)}</div>
					<div className={STAT_LABEL_CLASSES}>Tool Calls</div>
				</div>
			</div>

			<div className={STAT_CARD_CLASSES}>
				<div className={STAT_LABEL_CLASSES}>Tokens</div>
				<div className={`${STATS_ROW_CLASSES} ${STATS_ROW_4_CLASSES} ${TOKEN_ROW_CLASSES}`}>
					<div title={fmt.format(stats.inputTokens)}>
						<div className={STAT_VALUE_CLASSES}>{compactNumber(stats.inputTokens)}</div>
						<div className={STAT_SUBLABEL_CLASSES}>Input</div>
					</div>
					<div title={fmt.format(stats.outputTokens)}>
						<div className={STAT_VALUE_CLASSES}>{compactNumber(stats.outputTokens)}</div>
						<div className={STAT_SUBLABEL_CLASSES}>Output</div>
					</div>
					<div title={fmt.format(stats.cacheReadTokens)}>
						<div className={STAT_VALUE_CLASSES}>{compactNumber(stats.cacheReadTokens)}</div>
						<div className={STAT_SUBLABEL_CLASSES}>Cache Read</div>
					</div>
					<div title={fmt.format(stats.cacheCreationTokens)}>
						<div className={STAT_VALUE_CLASSES}>{compactNumber(stats.cacheCreationTokens)}</div>
						<div className={STAT_SUBLABEL_CLASSES}>Cache Creation</div>
					</div>
				</div>
			</div>

			{sortedModels.length > 0 && (
				<div className={STAT_CARD_CLASSES}>
					<div className={STAT_LABEL_CLASSES}>Models</div>
					<ul className={MODEL_LIST_CLASSES}>
						{sortedModels.map(([model, usage]) => (
							<li key={model} className={MODEL_LIST_ITEM_CLASSES}>
								<span className={MODEL_NAME_CLASSES}>{simplifyModelName(model)}</span>
								<span className={MODEL_COUNT_CLASSES}>{compactNumber(totalTokens(usage))} tokens</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
