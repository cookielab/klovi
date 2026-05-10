import { CodeBox } from "@cookielab.io/klovi-design-system";
import { SmartToolOutput } from "../tools/index";
import type { UserTurn } from "../types/index";

type UserBashContentProps = {
	turn: UserTurn;
};

const LABEL_CLASSES = "mb-1 text-[0.7rem] font-semibold uppercase text-foreground-subtle";

export function UserBashContent({ turn }: UserBashContentProps) {
	const output = [turn.bashStdout, turn.bashStderr].filter(Boolean).join("\n");
	const isError = !turn.bashStdout && Boolean(turn.bashStderr);

	return (
		<>
			{turn.bashInput !== undefined && (
				<div className={output ? "mb-2" : ""}>
					<div className={LABEL_CLASSES}>Command</div>
					<CodeBox language="bash">{turn.bashInput}</CodeBox>
				</div>
			)}
			{output && <SmartToolOutput output={output} isError={isError} />}
		</>
	);
}
