import type { DashboardStats } from "../../shared/types.ts";
import { scanStats } from "../parser/stats.ts";

const CACHE_TTL = 300_000; // 5 minutes

let cache: { data: DashboardStats; timestamp: number } | null = null;

export async function handleStats(): Promise<Response> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return Response.json({ stats: cache.data });
  }

  const stats = await scanStats();
  cache = { data: stats, timestamp: now };
  return Response.json({ stats });
}
