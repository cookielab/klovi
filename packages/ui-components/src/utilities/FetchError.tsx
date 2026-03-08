import { Button } from "@cookielab.io/klovi-design-system";
import styles from "./FetchError.module.css";

function s(name: string | undefined): string {
  return name ?? "";
}

interface FetchErrorProps {
  error: string;
  onRetry?: () => void;
  showPrefix?: boolean;
}

export function FetchError({ error, onRetry, showPrefix = false }: FetchErrorProps) {
  return (
    <div className={s(styles["fetchError"])}>
      <span className={s(styles["fetchErrorMessage"])}>
        {showPrefix ? `Error: ${error}` : error}
      </span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
