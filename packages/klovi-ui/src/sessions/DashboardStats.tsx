import type { ModelTokenUsage, DashboardStats as Stats } from "../types/index.ts";
import { FetchError } from "../utilities/FetchError.tsx";
import styles from "./DashboardStats.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

const fmt = new Intl.NumberFormat();
const CLAUDE_MODEL_NAME_REGEX = /claude-(\w+-[\d-]+?)(?:-\d{8})?$/;

function compactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function simplifyModelName(model: string): string {
  const match = model.match(CLAUDE_MODEL_NAME_REGEX);
  return match?.[1] ?? model;
}

function totalTokens(usage: ModelTokenUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
}

export interface DashboardStatsProps {
  stats: Stats | null;
  loading?: boolean | undefined;
  error?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export function DashboardStats({ stats, loading, error, onRetry }: DashboardStatsProps) {
  if (loading) {
    return (
      <div className={s(styles["dashboardStats"])}>
        <div className={`${s(styles["statsRow"])} ${s(styles["statsRow3"])}`}>
          {["skeleton-0", "skeleton-1", "skeleton-2"].map((key) => (
            <div
              key={key}
              className={`${s(styles["statCard"])} ${s(styles["statCardSkeleton"])}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <FetchError error={error} {...(onRetry ? { onRetry } : {})} />;

  if (!stats) return null;

  const sortedModels = Object.entries(stats.models).sort(
    (a, b) => totalTokens(b[1]) - totalTokens(a[1]),
  );

  return (
    <div className={s(styles["dashboardStats"])}>
      <div className={`${s(styles["statsRow"])} ${s(styles["statsRow3"])}`}>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.projects)}</div>
          <div className={s(styles["statLabel"])}>Projects</div>
        </div>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.sessions)}</div>
          <div className={s(styles["statLabel"])}>Sessions</div>
        </div>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.messages)}</div>
          <div className={s(styles["statLabel"])}>Messages</div>
        </div>
      </div>

      <div className={`${s(styles["statsRow"])} ${s(styles["statsRow3"])}`}>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.todaySessions)}</div>
          <div className={s(styles["statLabel"])}>Today Sessions</div>
        </div>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.thisWeekSessions)}</div>
          <div className={s(styles["statLabel"])}>This Week</div>
        </div>
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statValue"])}>{fmt.format(stats.toolCalls)}</div>
          <div className={s(styles["statLabel"])}>Tool Calls</div>
        </div>
      </div>

      <div className={s(styles["statCard"])}>
        <div className={s(styles["statLabel"])}>Tokens</div>
        <div
          className={`${s(styles["statsRow"])} ${s(styles["statsRow4"])} ${s(styles["tokenRow"])}`}
        >
          <div title={fmt.format(stats.inputTokens)}>
            <div className={s(styles["statValue"])}>{compactNumber(stats.inputTokens)}</div>
            <div className={s(styles["statSublabel"])}>Input</div>
          </div>
          <div title={fmt.format(stats.outputTokens)}>
            <div className={s(styles["statValue"])}>{compactNumber(stats.outputTokens)}</div>
            <div className={s(styles["statSublabel"])}>Output</div>
          </div>
          <div title={fmt.format(stats.cacheReadTokens)}>
            <div className={s(styles["statValue"])}>{compactNumber(stats.cacheReadTokens)}</div>
            <div className={s(styles["statSublabel"])}>Cache Read</div>
          </div>
          <div title={fmt.format(stats.cacheCreationTokens)}>
            <div className={s(styles["statValue"])}>{compactNumber(stats.cacheCreationTokens)}</div>
            <div className={s(styles["statSublabel"])}>Cache Creation</div>
          </div>
        </div>
      </div>

      {sortedModels.length > 0 && (
        <div className={s(styles["statCard"])}>
          <div className={s(styles["statLabel"])}>Models</div>
          <ul className={s(styles["modelList"])}>
            {sortedModels.map(([model, usage]) => (
              <li key={model} className={s(styles["modelListItem"])}>
                <span className={s(styles["modelName"])}>{simplifyModelName(model)}</span>
                <span className={s(styles["modelCount"])}>
                  {compactNumber(totalTokens(usage))} tokens
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
