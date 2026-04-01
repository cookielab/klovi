import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKloviClient, useKloviHostBridge } from "../../lib/context.ts";
import type { KloviHostConnectionState } from "../../lib/host-bridge.ts";
import type { Project, SessionSummary } from "../../shared/types.ts";
import { restoreFromHash, type ViewState, viewToHash } from "../view-state.ts";

type UseViewStateResult = {
	view: ViewState;
	ready: boolean;
	setView: Dispatch<SetStateAction<ViewState>>;
	selectProject: (project: Project) => void;
	selectSession: (session: SessionSummary) => void;
	goHome: () => void;
	goHidden: () => void;
	goSettings: () => void;
	closeSettings: () => void;
	canPresent: boolean;
	togglePresentation: () => void;
	hostConnectionState: KloviHostConnectionState;
	retryRestore: () => void;
};

function shouldKeepCurrentView(view: ViewState): boolean {
	return view.kind === "project" || view.kind === "session" || view.kind === "subagent";
}

export function useViewState(): UseViewStateResult {
	const client = useKloviClient();
	const hostBridge = useKloviHostBridge();
	const [view, setViewState] = useState<ViewState>({ kind: "home" });
	const [ready, setReady] = useState(false);
	const [hostConnectionState, setHostConnectionState] = useState<KloviHostConnectionState>(
		hostBridge.getConnectionState(),
	);
	const previousView = useRef<ViewState>({ kind: "home" });
	const currentView = useRef<ViewState>({ kind: "home" });
	const pendingHashRef = useRef<string | null>(null);

	const applyRestoredView = useCallback((nextView: ViewState, preserveCurrentView: boolean) => {
		if (nextView.kind === "restoring") {
			pendingHashRef.current = nextView.hash;
			if (!(preserveCurrentView && shouldKeepCurrentView(currentView.current))) {
				setViewState(nextView);
			}
			return;
		}

		pendingHashRef.current = null;
		setViewState(nextView);
	}, []);

	const setView = useCallback<Dispatch<SetStateAction<ViewState>>>((nextView) => {
		pendingHashRef.current = null;
		setViewState(nextView);
	}, []);

	const retryRestore = useCallback(() => {
		const pendingHash = pendingHashRef.current;
		if (!pendingHash) {
			return;
		}

		if (window.location.hash !== pendingHash) {
			window.location.hash = pendingHash;
		}

		restoreFromHash(client)
			.then((nextView) => {
				applyRestoredView(nextView, true);
			})
			.catch(() => {});
	}, [applyRestoredView, client]);

	useEffect(() => {
		currentView.current = view;
	}, [view]);

	useEffect(() => {
		setHostConnectionState(hostBridge.getConnectionState());
		return hostBridge.onConnectionState(setHostConnectionState);
	}, [hostBridge]);

	useEffect(() => {
		restoreFromHash(client)
			.then((nextView) => {
				applyRestoredView(nextView, false);
				setReady(true);
			})
			.catch(() => {});
	}, [applyRestoredView, client]);

	useEffect(() => {
		if (!ready) {
			return;
		}
		const newHash = viewToHash(view);
		if (window.location.hash !== newHash) {
			window.location.hash = newHash;
		}
	}, [view, ready]);

	useEffect(() => {
		const handler = () => {
			restoreFromHash(client)
				.then((nextView) => {
					applyRestoredView(nextView, true);
				})
				.catch(() => {});
		};
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, [applyRestoredView, client]);

	useEffect(() => {
		if (hostConnectionState !== "connected" || !pendingHashRef.current) {
			return;
		}

		retryRestore();
	}, [hostConnectionState, retryRestore]);

	const selectProject = useCallback((project: Project) => {
		pendingHashRef.current = null;
		setViewState({ kind: "project", project: project });
	}, []);

	const selectSession = useCallback((session: SessionSummary) => {
		pendingHashRef.current = null;
		setViewState((current) => {
			if (current.kind === "project" || current.kind === "session") {
				return {
					kind: "session",
					project: current.project,
					session: session,
					presenting: false,
				};
			}
			return current;
		});
	}, []);

	const goHome = useCallback(() => {
		pendingHashRef.current = null;
		setViewState({ kind: "home" });
	}, []);
	const goHidden = useCallback(() => {
		pendingHashRef.current = null;
		setViewState({ kind: "hidden" });
	}, []);
	const goSettings = useCallback(() => {
		pendingHashRef.current = null;
		setViewState((current) => {
			if (current.kind === "settings") {
				return previousView.current;
			}
			previousView.current = current;
			return { kind: "settings" };
		});
	}, []);
	const closeSettings = useCallback(() => {
		pendingHashRef.current = null;
		setViewState(previousView.current);
	}, []);
	const canPresent = view.kind === "session" || view.kind === "subagent";

	const togglePresentation = useCallback(() => {
		setViewState((current) => {
			if (current.kind === "session" || current.kind === "subagent") {
				return { ...current, presenting: !current.presenting };
			}
			return current;
		});
	}, []);

	return {
		view: view,
		ready: ready,
		setView: setView,
		selectProject: selectProject,
		selectSession: selectSession,
		goHome: goHome,
		goHidden: goHidden,
		goSettings: goSettings,
		closeSettings: closeSettings,
		canPresent: canPresent,
		togglePresentation: togglePresentation,
		hostConnectionState: hostConnectionState,
		retryRestore: retryRestore,
	};
}
