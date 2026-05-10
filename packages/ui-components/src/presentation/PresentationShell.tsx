import { Text } from "@cookielab.io/klovi-design-system";
import type { FrontendPlugin } from "@cookielab.io/klovi-plugin-core";
import { useEffect, useRef } from "react";
import { MessageList } from "../messages/index";
import type { Turn } from "../types/index";
import { useKeyboard } from "./useKeyboard";
import { usePresentationMode } from "./usePresentationMode";


const T_STEP = "Step";
const T_SP_1 = " ";
const T_TEXT = "/";
const T_STEP_MESSAGE_ESC_EXIT_F_FULLSC = "← → step · ↑ ↓ message · Esc exit · F fullscreen";

type PresentationShellProps = {
	turns: Turn[];
	onExit: () => void;
	sessionId?: string | undefined;
	project?: string | undefined;
	pluginId?: string | undefined;
	isSubAgent?: boolean | undefined;
	onLinkClick?: ((url: string) => void) | undefined;
	getFrontendPlugin?: ((id: string) => FrontendPlugin | undefined) | undefined;
	onNavigateToSubAgent?: ((id: string) => void) | undefined;
	theme?: string | undefined;
	fontSize?: number | undefined;
};

const SHELL_CLASSES = "overflow-y-auto h-[calc(100vh-92px)]";
const FULLSCREEN_CLASSES = "fixed inset-0 z-[100] overflow-y-auto bg-surface";
const PROGRESS_CLASSES =
	"fixed right-0 bottom-0 left-0 z-20 flex h-10 items-center justify-center gap-4 border-border border-t bg-surface-muted text-[0.85rem] text-foreground-muted";
const PROGRESS_BAR_CLASSES = "h-1 w-[200px] overflow-hidden bg-surface-sunken";
const PROGRESS_FILL_CLASSES = "h-full bg-accent transition-[width] duration-200 ease-[ease]";
const HINT_CLASSES = "text-[0.75rem]";

export function PresentationShell({
	turns,
	onExit,
	sessionId,
	project,
	pluginId,
	isSubAgent,
	onLinkClick,
	getFrontendPlugin,
}: PresentationShellProps): React.ReactNode {
	const scrollRef = useRef<HTMLDivElement>(null);
	const presentation = usePresentationMode(turns);

	// Auto-enter presentation when turns are available
	useEffect(() => {
		if (turns.length > 0 && !presentation.active) {
			presentation.enter();
		}
	}, [turns, presentation]);

	useKeyboard(
		{
			onNext: presentation.next,
			onPrev: presentation.prev,
			onNextTurn: presentation.nextTurn,
			onPrevTurn: presentation.prevTurn,
			onEscape: onExit,
			onFullscreen: presentation.toggleFullscreen,
		},
		presentation.active,
	);

	// Auto-scroll to bottom when step changes
	const { currentStep } = presentation;
	useEffect(() => {
		if (currentStep >= 0 && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [currentStep]);

	const percentMultiplier = 100;
	const progress =
		presentation.totalSteps > 0 ? ((presentation.currentStep + 1) / presentation.totalSteps) * percentMultiplier : 0;

	const className = presentation.fullscreen ? FULLSCREEN_CLASSES : SHELL_CLASSES;

	return (
		<div className={className} ref={scrollRef}>
			<MessageList
				turns={presentation.visibleTurns}
				visibleSubSteps={presentation.visibleSubSteps}
				sessionId={sessionId}
				project={project}
				pluginId={pluginId}
				isSubAgent={isSubAgent}
				onLinkClick={onLinkClick}
				getFrontendPlugin={getFrontendPlugin}
			/>
			<div className={PROGRESS_CLASSES}>
				<span>
					<Text>{T_STEP}</Text><Text>{T_SP_1}</Text>{presentation.currentStep + 1}<Text>{T_SP_1}</Text><Text>{T_TEXT}</Text><Text>{T_SP_1}</Text>{presentation.totalSteps}
				</span>
				<div className={PROGRESS_BAR_CLASSES}>
					<div className={PROGRESS_FILL_CLASSES} style={{ width: `${progress}%` }} />
				</div>
				<span className={HINT_CLASSES}><Text>{T_STEP_MESSAGE_ESC_EXIT_F_FULLSC}</Text></span>
			</div>
		</div>
	);
}
