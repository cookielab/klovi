export function sortByIsoDesc<T>(items: T[], select: (item: T) => string): void {
  items.sort((a, b) => select(b).localeCompare(select(a)));
}

export function maxIso(values: readonly string[]): string {
  let latest = "";
  for (const value of values) {
    if (value > latest) latest = value;
  }
  return latest;
}

export function epochMsToIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export function epochSecondsToIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString();
}
