import { Button } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { Component } from "react";

type ErrorBoundaryProps = {
	children: React.ReactNode;
	/** When true, renders a compact inline error card instead of a full-page error view. */
	inline?: boolean;
};

type ErrorBoundaryState = {
	error: Error | null;
};

// biome-ignore lint/style/useReactFunctionComponents: Error boundaries require class components
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error: error };
	}

	retry = () => {
		this.setState({ error: null });
	};

	override render() {
		const { error } = this.state;
		if (!error) {
			return this.props.children;
		}

		if (this.props.inline) {
			return (
				<div className="my-2 border border-error border-l-4 bg-surface px-4 py-3 text-[0.85rem]">
					<div className="flex items-center justify-between gap-2">
						<span className="font-semibold text-error">Failed to render</span>
						<Button size="sm" onClick={this.retry}>
							Retry
						</Button>
					</div>
					<details className="mt-2">
						<summary className="cursor-pointer select-none text-[0.8em] text-foreground-subtle">Error details</summary>
						<pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all bg-surface-sunken p-2 text-[0.8em]">
							{error.stack || error.message}
						</pre>
					</details>
				</div>
			);
		}

		return (
			<div className="flex flex-col items-center justify-center p-10 text-center">
				<div className="mb-2 font-semibold text-[1.1rem] text-error">Something went wrong</div>
				<div className="mb-4 text-[0.9rem] text-foreground-muted">{error.message}</div>
				<Button variant="primary" onClick={this.retry}>
					Try Again
				</Button>
			</div>
		);
	}
}
