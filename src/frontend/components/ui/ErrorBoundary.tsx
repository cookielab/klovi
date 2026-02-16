import type React from "react";
import { Component } from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** When true, renders a compact inline error card instead of a full-page error view. */
  inline?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  retry = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.inline) {
      return (
        <div className="error-card">
          <div className="error-card-header">
            <span className="error-card-title">Failed to render</span>
            <button type="button" className="btn btn-sm" onClick={this.retry}>
              Retry
            </button>
          </div>
          <details className="error-card-details">
            <summary>Error details</summary>
            <pre>{error.stack || error.message}</pre>
          </details>
        </div>
      );
    }

    return (
      <div className="error-view">
        <div className="error-view-title">Something went wrong</div>
        <div className="error-view-message">{error.message}</div>
        <button type="button" className="btn btn-primary" onClick={this.retry}>
          Try Again
        </button>
      </div>
    );
  }
}
