import type { ModelTokenUsage, DashboardStats as Stats } from "../../../shared/types.ts";
import { useRPC } from "../../hooks/useRpc.ts";
import { getRPC } from "../../rpc.ts";

const fmt = new Intl.NumberFormat();

function compactNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function simplifyModelName(model: string): string {
  const match = model.match(/claude-(\w+-[\d-]+?)(?:-\d{8})?$/);
  return match?.[1] ?? model;
}

function totalTokens(usage: ModelTokenUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
}

export function DashboardStats() {
  const { data, loading, error, retry } = useRPC<{ stats: Stats }>(
    () => getRPC().request.getStats({}),
    [],
  );

  if (loading) {
    return (
      <div className="dashboard-stats">
        <div className="stats-row stats-row-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`skeleton-${i}`} className="stat-card stat-card-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fetch-error">
        <span className="fetch-error-message">{error}</span>
        <button type="button" className="btn btn-sm" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  if (!stats) return null;

  const sortedModels = Object.entries(stats.models).sort(
    (a, b) => totalTokens(b[1]) - totalTokens(a[1]),
  );

  return (
    <div className="dashboard-stats">
      <div className="stats-row stats-row-3">
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.projects)}</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.sessions)}</div>
          <div className="stat-label">Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.messages)}</div>
          <div className="stat-label">Messages</div>
        </div>
      </div>

      <div className="stats-row stats-row-3">
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.todaySessions)}</div>
          <div className="stat-label">Today Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.thisWeekSessions)}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt.format(stats.toolCalls)}</div>
          <div className="stat-label">Tool Calls</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Tokens</div>
        <div className="stats-row stats-row-4 token-row">
          <div title={fmt.format(stats.inputTokens)}>
            <div className="stat-value">{compactNumber(stats.inputTokens)}</div>
            <div className="stat-sublabel">Input</div>
          </div>
          <div title={fmt.format(stats.outputTokens)}>
            <div className="stat-value">{compactNumber(stats.outputTokens)}</div>
            <div className="stat-sublabel">Output</div>
          </div>
          <div title={fmt.format(stats.cacheReadTokens)}>
            <div className="stat-value">{compactNumber(stats.cacheReadTokens)}</div>
            <div className="stat-sublabel">Cache Read</div>
          </div>
          <div title={fmt.format(stats.cacheCreationTokens)}>
            <div className="stat-value">{compactNumber(stats.cacheCreationTokens)}</div>
            <div className="stat-sublabel">Cache Creation</div>
          </div>
        </div>
      </div>

      {sortedModels.length > 0 && (
        <div className="stat-card">
          <div className="stat-label">Models</div>
          <ul className="model-list">
            {sortedModels.map(([model, usage]) => (
              <li key={model}>
                <span className="model-name">{simplifyModelName(model)}</span>
                <span className="model-count">{compactNumber(totalTokens(usage))} tokens</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
