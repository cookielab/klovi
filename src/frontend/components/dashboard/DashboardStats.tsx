import { useEffect, useState } from "react";
import type { DashboardStats as Stats } from "../../../shared/types.ts";

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

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dashboard-stats">
        <div className="stats-row stats-row-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="stat-card stat-card-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const sortedModels = Object.entries(stats.models).sort((a, b) => b[1] - a[1]);

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
            {sortedModels.map(([model, count]) => (
              <li key={model}>
                <span className="model-name">{simplifyModelName(model)}</span>
                <span className="model-count">{fmt.format(count)} turns</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
