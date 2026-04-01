import { SearchModal as UiSearchModal } from "@cookielab.io/klovi-ui-components/search";
import type { GlobalSessionResult } from "../../../shared/types.ts";

type PackageSearchModalProps = {
	sessions: GlobalSessionResult[];
	onSelect: (encodedPath: string, sessionId: string) => void;
	onClose: () => void;
};

export function PackageSearchModal({ sessions, onSelect, onClose }: PackageSearchModalProps) {
	return (
		<UiSearchModal
			open={true}
			sessions={sessions}
			onClose={onClose}
			onSelect={(result) => onSelect(result.encodedPath, result.sessionId)}
		/>
	);
}
