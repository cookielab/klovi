import { Button, Text } from "@cookielab.io/klovi-design-system";
import type { ReactNode } from "react";

type FetchErrorProps = {
	error: string;
	onRetry?: () => void;
	showPrefix?: boolean;
};

const RETRY_LABEL = "Retry";

export function FetchError({ error, onRetry, showPrefix = false }: FetchErrorProps): ReactNode {
	return (
		<div className="flex flex-col items-center justify-center gap-3 p-10 text-[0.9rem] text-foreground-muted">
			<span className="text-error">{showPrefix ? `Error: ${error}` : `${error}`}</span>
			{onRetry ? (
				<Button size="sm" onClick={onRetry}>
					<Text>{RETRY_LABEL}</Text>
				</Button>
			) : null}
		</div>
	);
}
