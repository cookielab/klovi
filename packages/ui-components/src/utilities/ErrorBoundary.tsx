import { Button, Text } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { Component } from "react";

const T_FAILED_TO_RENDER = "Failed to render";
const T_RETRY = "Retry";
const T_ERROR_DETAILS = "Error details";
const T_SOMETHING_WENT_WRONG = "Something went wrong";
const T_TRY_AGAIN = "Try Again";

type ErrorBoundaryProps = {
	children: React.ReactNode;
	/** When true, renders a compact inline error card instead of a full-page error view. */
	inline?: boolean;
};

type ErrorBoundaryState = {
	error: Error | null;
};

type ErrorFallbackProps = {
	error: Error;
	onRetry: () => void;
	inline: boolean | undefined;
};

function ErrorFallback({ error, onRetry, inline }: ErrorFallbackProps): React.ReactNode {
	if (inline) {
		return (
			<div className="my-2 border border-error border-l-4 bg-surface px-4 py-3 text-[0.85rem]">
				<div className="flex items-center justify-between gap-2">
					<span className="font-semibold text-error">
						<Text>{T_FAILED_TO_RENDER}</Text>
					</span>
					<Button size="sm" onClick={onRetry}>
						<Text>{T_RETRY}</Text>
					</Button>
				</div>
				<details className="mt-2">
					<summary className="cursor-pointer select-none text-[0.8em] text-foreground-subtle">
						<Text>{T_ERROR_DETAILS}</Text>
					</summary>
					<pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all bg-surface-sunken p-2 text-[0.8em]">
						{error.stack || error.message}
					</pre>
				</details>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center p-10 text-center">
			<div className="mb-2 font-semibold text-[1.1rem] text-error">
				<Text>{T_SOMETHING_WENT_WRONG}</Text>
			</div>
			<div className="mb-4 text-[0.9rem] text-foreground-muted">{error.message}</div>
			<Button variant="primary" onClick={onRetry}>
				<Text>{T_TRY_AGAIN}</Text>
			</Button>
		</div>
	);
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	public override state: ErrorBoundaryState = { error: null };

	public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error: error };
	}

	public override componentDidCatch(_error: Error): void {
		// Error captured via getDerivedStateFromError; no further side effects.
	}

	public retry = (): void => {
		this.setState({ error: null });
	};

	public override render(): React.ReactNode {
		const { error } = this.state;
		if (!error) {
			return this.props.children;
		}
		return <ErrorFallback error={error} onRetry={this.retry} inline={this.props.inline} />;
	}
}
