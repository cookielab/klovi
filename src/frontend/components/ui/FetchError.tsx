interface FetchErrorProps {
  error: string;
  onRetry?: () => void;
  showPrefix?: boolean;
}

export function FetchError({ error, onRetry, showPrefix = false }: FetchErrorProps) {
  return (
    <div className="fetch-error">
      <span className="fetch-error-message">{showPrefix ? `Error: ${error}` : error}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
