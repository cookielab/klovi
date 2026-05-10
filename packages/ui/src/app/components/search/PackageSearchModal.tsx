import { SearchModal as UiSearchModal } from "@cookielab.io/klovi-ui-components/search";
import { useCallback } from "react";
import type { GlobalSessionResult } from "../../../shared/types";

type PackageSearchModalProps = {
	sessions: GlobalSessionResult[];
	onSelect: (encodedPath: string, sessionId: string) => void;
	onClose: () => void;
};

export function PackageSearchModal({ sessions, onSelect, onClose }: PackageSearchModalProps) {
	const handleSelect = useCallback(
		(result: GlobalSessionResult) => onSelect(result.encodedPath, result.sessionId),
		[onSelect],
	);

	return <UiSearchModal open={true} sessions={sessions} onClose={onClose} onSelect={handleSelect} />;
}
