import { Button } from "@cookielab.io/klovi-design-system";
import type { RpcError } from "../../../lib/rpc-errors-effect.ts";
import "./TypedErrorDisplay.css";

type TypedErrorDisplayProps = {
	error: RpcError;
	onRetry?: () => void;
};

function getErrorContent(error: RpcError): { title: string; detail: string } {
	switch (error._tag) {
		case "RpcTimeoutError":
			return {
				title: "Request timed out",
				detail: "The request took too long to complete.",
			};
		case "RpcDisconnectedError":
			return {
				title: "Connection lost",
				detail: "The connection to the desktop host was interrupted.",
			};
		case "RpcHandlerError":
			return {
				title: "Something went wrong",
				detail: error.reason,
			};
		default: {
			const _exhaustive: never = error;
			return _exhaustive;
		}
	}
}

export function TypedErrorDisplay({ error, onRetry }: TypedErrorDisplayProps) {
	const { title, detail } = getErrorContent(error);

	return (
		<div className="typed-error-display">
			<span className="typed-error-title">{title}</span>
			<span className="typed-error-detail">{detail}</span>
			{onRetry ? (
				<Button size="sm" onClick={onRetry}>
					Retry
				</Button>
			) : null}
		</div>
	);
}
