import { SearchModal as UISearchModal } from "@cookielab.io/klovi-ui/search";
import type { GlobalSessionResult } from "../../../shared/types.ts";

interface PackageSearchModalProps {
  sessions: GlobalSessionResult[];
  onSelect: (encodedPath: string, sessionId: string) => void;
  onClose: () => void;
}

export function PackageSearchModal({ sessions, onSelect, onClose }: PackageSearchModalProps) {
  return (
    <UISearchModal
      open
      sessions={sessions}
      onClose={onClose}
      onSelect={(result) => onSelect(result.encodedPath, result.sessionId)}
    />
  );
}
