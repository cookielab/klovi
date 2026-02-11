import { useEffect, useState } from "react";
import type { DashboardStats as Stats } from "../../../shared/types.ts";

const fmt = new Intl.NumberFormat();

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{fmt.format(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ModelCard({ models }: { models: Record<string, number> }) {
  const sorted = Object.entries(models).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  return (
    <div className="stat-card stat-card-models">
      <div className="stat-label">Models Used</div>
      <ul className="model-list">
        {sorted.map(([model, count]) => (
          <li key={model}>
            <span className="model-name">{simplifyModelName(model)}</span>
            <span className="model-count">{fmt.format(count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function simplifyModelName(model: string): string {
  // "claude-sonnet-4-5-20250929" -> "sonnet-4-5"
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
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="stat-card stat-card-skeleton" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="dashboard-stats">
      <StatCard label="Projects" value={stats.projects} />
      <StatCard label="Sessions" value={stats.sessions} />
      <StatCard label="Input Tokens" value={stats.inputTokens} />
      <StatCard label="Output Tokens" value={stats.outputTokens} />
      <StatCard label="Cache Read Tokens" value={stats.cacheReadTokens} />
      <StatCard label="Cache Creation Tokens" value={stats.cacheCreationTokens} />
      <StatCard label="Tool Calls" value={stats.toolCalls} />
      <ModelCard models={stats.models} />
    </div>
  );
}
