import { useCallback, useState } from "react";

interface HiddenProjectsStoreV1 {
  version: 1;
  hiddenIds: string[];
}

const STORAGE_KEY = "klovi-hidden-projects";

function loadHiddenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      (parsed as HiddenProjectsStoreV1).version === 1 &&
      "hiddenIds" in parsed &&
      Array.isArray((parsed as HiddenProjectsStoreV1).hiddenIds)
    ) {
      return new Set((parsed as HiddenProjectsStoreV1).hiddenIds);
    }
  } catch {
    // corrupted data — fall through
  }
  return new Set();
}

function persistHiddenIds(ids: Set<string>): void {
  const store: HiddenProjectsStoreV1 = {
    version: 1,
    hiddenIds: [...ids],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useHiddenProjects() {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadHiddenIds());

  const hide = useCallback((encodedPath: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(encodedPath);
      persistHiddenIds(next);
      return next;
    });
  }, []);

  const unhide = useCallback((encodedPath: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(encodedPath);
      persistHiddenIds(next);
      return next;
    });
  }, []);

  const isHidden = useCallback((encodedPath: string) => hiddenIds.has(encodedPath), [hiddenIds]);

  return { hiddenIds, hide, unhide, isHidden };
}
