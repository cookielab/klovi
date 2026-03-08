import { Button } from "@cookielab.io/klovi-design-system";
import type React from "react";
import { Component } from "react";
import styles from "./ErrorBoundary.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** When true, renders a compact inline error card instead of a full-page error view. */
  inline?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

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
        <div className={s(styles["errorCard"])}>
          <div className={s(styles["errorCardHeader"])}>
            <span className={s(styles["errorCardTitle"])}>Failed to render</span>
            <Button size="sm" onClick={this.retry}>
              Retry
            </Button>
          </div>
          <details className={s(styles["errorCardDetails"])}>
            <summary>Error details</summary>
            <pre>{error.stack || error.message}</pre>
          </details>
        </div>
      );
    }

    return (
      <div className={s(styles["errorView"])}>
        <div className={s(styles["errorViewTitle"])}>Something went wrong</div>
        <div className={s(styles["errorViewMessage"])}>{error.message}</div>
        <Button variant="primary" onClick={this.retry}>
          Try Again
        </Button>
      </div>
    );
  }
}
