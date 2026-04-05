import { Button } from "@cookielab.io/klovi-design-system";

type FetchErrorProps = {
	error: string;
	onRetry?: () => void;
	showPrefix?: boolean;
};

export function FetchError({ error, onRetry, showPrefix = false }: FetchErrorProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 p-10 text-[0.9rem] text-foreground-muted">
			{/* biome-ignore lint/nursery/noLeakedRender: error is always a non-empty string prop */}
			<span className="text-error">{showPrefix ? `Error: ${error}` : error}</span>
			{onRetry ? (
				<Button size="sm" onClick={onRetry}>
					Retry
				</Button>
			) : null}
		</div>
	);
}
