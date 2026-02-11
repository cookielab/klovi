import { useCallback, useEffect, useRef, useState } from "react";
import type { GlobalSessionResult } from "../../../shared/types.ts";
import { shortModel } from "../../utils/model.ts";
import { formatRelativeTime } from "../../utils/time.ts";

interface SearchModalProps {
  sessions: GlobalSessionResult[];
  onSelect: (encodedPath: string, sessionId: string) => void;
  onClose: () => void;
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

export function SearchModal({ sessions, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? sessions.filter((s) => matchesQuery(s, query)).slice(0, MAX_RESULTS)
    : sessions.slice(0, MAX_RESULTS);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      onSelect(result.encodedPath, result.sessionId);
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

  return (
    <div className="search-overlay" onMouseDown={onClose}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            className="search-input"
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
        <div className="search-results" ref={resultsRef}>
          {filtered.length === 0 ? (
            <div className="search-empty">No results found</div>
          ) : (
            filtered.map((result, index) => (
              <div
                key={`${result.encodedPath}-${result.sessionId}`}
                className={`search-result-item ${index === highlightedIndex ? "highlighted" : ""}`}
                data-search-item
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="search-result-title">
                  <span>{result.firstMessage}</span>
                  {result.sessionType && (
                    <span className={`session-type-badge ${result.sessionType}`}>
                      {result.sessionType}
                    </span>
                  )}
                </div>
                <div className="search-result-meta">
                  {result.projectName} &middot; {shortModel(result.model)}
                  {result.gitBranch ? ` \u00b7 ${result.gitBranch}` : ""} &middot;{" "}
                  {formatRelativeTime(result.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
