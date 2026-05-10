import { Text } from "@cookielab.io/klovi-design-system";
import { BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES } from "@cookielab.io/klovi-plugin-core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GlobalSessionResult } from "../types/index";
import { formatFullDateTime, formatRelativeTime } from "../utilities/formatters";


const T_SP_1 = " ";
const T_MIDDOT = "&middot;";
const T_NO_RESULTS_FOUND = "No results found";
const T_8593_8595 = "&#8593;&#8595;";
const T_NAVIGATE = "navigate";
const T_8629 = "&#8629;";
const T_OPEN = "open";
const T_ESC = "esc";
const T_CLOSE = "close";

function defaultPluginDisplayName(pluginId: string): string {
	return BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES[pluginId as keyof typeof BUILTIN_KLOVI_PLUGIN_DISPLAY_NAMES] ?? pluginId;
}

type SearchModalProps = {
	open: boolean;
	onClose: () => void;
	sessions: GlobalSessionResult[];
	onSelect: (result: GlobalSessionResult) => void;
	pluginDisplayName?: ((id: string) => string) | undefined;
};

const MAX_RESULTS = 20;

const OVERLAY_CLASSES = "fixed inset-0 z-[200] flex justify-center bg-black/40 pt-[15vh]";
const MODAL_CLASSES = "flex max-h-[480px] w-[560px] flex-col overflow-hidden border border-border bg-surface shadow-lg";
const INPUT_WRAPPER_CLASSES = "border-border-muted border-b px-4 py-3";
const INPUT_CLASSES =
	"w-full border-none bg-transparent py-2 font-inherit text-[1rem] text-foreground outline-none placeholder:text-foreground-subtle";
const RESULTS_CLASSES = "flex-1 overflow-y-auto py-1";
const RESULT_ITEM_BASE_CLASSES = "cursor-pointer px-4 py-2 transition-[background] duration-100 hover:bg-surface-muted";
const RESULT_ITEM_HIGHLIGHTED_CLASSES = "bg-surface-muted";
const RESULT_TITLE_CLASSES =
	"flex items-center gap-[6px] overflow-hidden text-[0.85rem] font-medium whitespace-nowrap text-ellipsis text-foreground";
const RESULT_META_CLASSES =
	"mt-[2px] overflow-hidden text-[0.75rem] whitespace-nowrap text-ellipsis text-foreground-subtle";
const EMPTY_CLASSES = "px-4 py-6 text-center text-[0.85rem] text-foreground-subtle";
const FOOTER_CLASSES =
	"flex gap-4 border-border-muted border-t px-4 py-2 text-[0.7rem] text-foreground-subtle [&_kbd]:inline-block [&_kbd]:bg-surface-sunken [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-inherit [&_kbd]:text-[0.65rem]";
const PLUGIN_BADGE_CLASSES =
	"inline-block bg-surface-sunken px-[6px] py-px align-middle text-[0.65rem] font-semibold uppercase tracking-[0.03em] leading-[1.4] text-foreground-subtle";
const SESSION_TYPE_BADGE_BASE_CLASSES =
	"inline-block px-[6px] py-px align-middle text-[0.65rem] font-semibold tracking-[0.02em] leading-[1.4]";
const SESSION_TYPE_BADGE_PLAN_CLASSES = "bg-plan-subtle text-plan";
const SESSION_TYPE_BADGE_IMPL_CLASSES = "bg-impl-subtle text-impl";

function matchesQuery(result: GlobalSessionResult, query: string): boolean {
	const q = query.toLowerCase();
	return (
		result.firstMessage.toLowerCase().includes(q) ||
		result.projectName.toLowerCase().includes(q) ||
		result.gitBranch.toLowerCase().includes(q)
	);
}

function SearchResultItem({
	result,
	index,
	highlightedIndex,
	onSelect,
	onHighlight,
	pluginDisplayName,
}: {
	result: GlobalSessionResult;
	index: number;
	highlightedIndex: number;
	onSelect: (result: GlobalSessionResult) => void;
	onHighlight: (index: number) => void;
	pluginDisplayName: (id: string) => string;
}): React.ReactNode {
	const handleClick = useCallback(() => onSelect(result), [onSelect, result]);
	const handleMouseEnter = useCallback(() => onHighlight(index), [onHighlight, index]);
	const isHighlighted = index === highlightedIndex;

	return (
		<div
			key={`${result.encodedPath}-${result.sessionId}`}
			className={`${RESULT_ITEM_BASE_CLASSES} ${isHighlighted ? RESULT_ITEM_HIGHLIGHTED_CLASSES : ""}`}
			data-search-item={true}
			role="option"
			tabIndex={-1}
			aria-selected={isHighlighted}
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
		>
			<div className={RESULT_TITLE_CLASSES}>
				<span>{result.firstMessage}</span>
				{result.sessionType ? (
					<span
						className={`${SESSION_TYPE_BADGE_BASE_CLASSES} ${
							result.sessionType === "plan" ? SESSION_TYPE_BADGE_PLAN_CLASSES : SESSION_TYPE_BADGE_IMPL_CLASSES
						}`}
					>
						{result.sessionType}
					</span>
				) : null}
			</div>
			<div className={RESULT_META_CLASSES}>
				{result.projectName}
				{result.pluginId ? (
					<>
						<Text>{T_SP_1}</Text>
						<span className={PLUGIN_BADGE_CLASSES}>{pluginDisplayName(result.pluginId)}</span>
					</>
				) : null}<Text>{T_SP_1}</Text>
				<Text>{T_MIDDOT}</Text><Text>{T_SP_1}</Text>
				<time dateTime={result.timestamp} title={formatFullDateTime(result.timestamp)}>
					{formatRelativeTime(result.timestamp)}
				</time>
			</div>
		</div>
	);
}

function SearchModal({
	open,
	onClose,
	sessions,
	onSelect,
	pluginDisplayName = defaultPluginDisplayName,
}: SearchModalProps): React.ReactNode {
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
		if (!container) {
			return;
		}
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
				default:
					break;
			}
		},
		[filtered, highlightedIndex, handleSelect, onClose],
	);

	const handleModalMouseDown = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
	}, []);

	const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
		setHighlightedIndex(0);
	}, []);

	if (!open) {
		return null;
	}

	return (
		<div className={OVERLAY_CLASSES} role="presentation" onMouseDown={onClose}>
			<div className={MODAL_CLASSES} role="presentation" onMouseDown={handleModalMouseDown}>
				<div className={INPUT_WRAPPER_CLASSES}>
					<input
						ref={inputRef}
						className={INPUT_CLASSES}
						type="text"
						placeholder="Search sessions..."
						value={query}
						onChange={handleQueryChange}
						onKeyDown={handleKeyDown}
					/>
				</div>
				<div className={RESULTS_CLASSES} role="listbox" ref={resultsRef}>
					{filtered.length === 0 ? (
						<div className={EMPTY_CLASSES}><Text>{T_NO_RESULTS_FOUND}</Text></div>
					) : (
						filtered.map((result, index) => (
							<SearchResultItem
								key={`${result.encodedPath}-${result.sessionId}`}
								result={result}
								index={index}
								highlightedIndex={highlightedIndex}
								onSelect={handleSelect}
								onHighlight={setHighlightedIndex}
								pluginDisplayName={pluginDisplayName}
							/>
						))
					)}
				</div>
				<div className={FOOTER_CLASSES}>
					<span>
						<kbd><Text>{T_8593_8595}</Text></kbd><Text>{T_SP_1}</Text><Text>{T_NAVIGATE}</Text>
					</span>
					<span>
						<kbd><Text>{T_8629}</Text></kbd><Text>{T_SP_1}</Text><Text>{T_OPEN}</Text>
					</span>
					<span>
						<kbd><Text>{T_ESC}</Text></kbd><Text>{T_SP_1}</Text><Text>{T_CLOSE}</Text>
					</span>
				</div>
			</div>
		</div>
	);
}

export type { SearchModalProps };
export { SearchModal };
