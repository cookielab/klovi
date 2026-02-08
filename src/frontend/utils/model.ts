export function shortModel(model: string): string {
  const match = model.match(/claude-(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?:-\d{8,})?$/);
  if (match) {
    const family = match[1]!.charAt(0).toUpperCase() + match[1]!.slice(1);
    const major = match[2]!;
    const minor = match[3];
    return minor ? `${family} ${major}.${minor}` : `${family} ${major}`;
  }
  return model;
}
