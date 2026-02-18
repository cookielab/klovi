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
