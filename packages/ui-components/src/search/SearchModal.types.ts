import type { GlobalSessionResult } from "../types/index";

export type SearchModalProps = {
	open: boolean;
	onClose: () => void;
	sessions: GlobalSessionResult[];
	onSelect: (result: GlobalSessionResult) => void;
	pluginDisplayName?: ((id: string) => string) | undefined;
};
