import { BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES } from "@cookielab.io/klovi-plugin-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GlobalSessionResult } from "../types/index.ts";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters.ts";
import styles from "./SearchModal.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

function defaultPluginDisplayName(pluginId: string): string {
  return (
    BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES[
      pluginId as keyof typeof BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES
    ] ?? pluginId
  );
}

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  sessions: GlobalSessionResult[];
  onSelect: (result: GlobalSessionResult) => void;
  pluginDisplayName?: ((id: string) => string) | undefined;
}

const MAX_RESULTS = 20;

function matchesQuery(result: GlobalSessionResult, query: string): boolean {
  const q = query.toLowerCase();
  return (
    result.firstMessage.toLowerCase().includes(q) ||
    result.projectName.toLowerCase().includes(q) ||
    result.gitBranch.toLowerCase().includes(q)
  );
}

export function SearchModal({
  open,
  onClose,
  sessions,
  onSelect,
  pluginDisplayName = defaultPluginDisplayName,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? sessions.filter((r) => matchesQuery(r, query)).slice(0, MAX_RESULTS)
    : sessions.slice(0, MAX_RESULTS);

  // Reset query when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
    }
  }, [open]);

  // Focus input when open
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const items = container.querySelectorAll("[data-search-item]");
    const item = items[highlightedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (result: GlobalSessionResult) => {
      onSelect(result);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[highlightedIndex]) {
            handleSelect(filtered[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, highlightedIndex, handleSelect, onClose],
  );

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay backdrop dismiss
    <div className={s(styles["overlay"])} role="presentation" onMouseDown={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation on modal body */}
      <div
        className={s(styles["modal"])}
        role="presentation"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s(styles["inputWrapper"])}>
          <input
            ref={inputRef}
            className={s(styles["input"])}
            type="text"
            placeholder="Search sessions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={s(styles["results"])} role="listbox" ref={resultsRef}>
          {filtered.length === 0 ? (
            <div className={s(styles["empty"])}>No results found</div>
          ) : (
            filtered.map((result, index) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by input onKeyDown
              <div
                key={`${result.encodedPath}-${result.sessionId}`}
                className={`${s(styles["resultItem"])} ${index === highlightedIndex ? s(styles["resultItemHighlighted"]) : ""}`}
                data-search-item
                role="option"
                tabIndex={-1}
                aria-selected={index === highlightedIndex}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className={s(styles["resultTitle"])}>
                  <span>{result.firstMessage}</span>
                  {result.sessionType && (
                    <span
                      className={`${s(styles["sessionTypeBadge"])} ${
                        result.sessionType === "plan"
                          ? s(styles["sessionTypeBadgePlan"])
                          : s(styles["sessionTypeBadgeImplementation"])
                      }`}
                    >
                      {result.sessionType}
                    </span>
                  )}
                </div>
                <div className={s(styles["resultMeta"])}>
                  {result.projectName}
                  {result.pluginId && (
                    <>
                      {" "}
                      <span className={s(styles["pluginBadge"])}>
                        {pluginDisplayName(result.pluginId)}
                      </span>
                    </>
                  )}{" "}
                  &middot;{" "}
                  <time dateTime={result.timestamp} title={formatFullDateTime(result.timestamp)}>
                    {formatRelativeTime(result.timestamp)}
                  </time>
                </div>
              </div>
            ))
          )}
        </div>
        <div className={s(styles["footer"])}>
          <span>
            <kbd>&#8593;&#8595;</kbd> navigate
          </span>
          <span>
            <kbd>&#8629;</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
