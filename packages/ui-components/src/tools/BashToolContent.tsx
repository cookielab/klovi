import { CodeBox } from "@cookielab.io/klovi-design-system";
import type { ToolCallWithResult } from "../types/index.ts";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

const SECTION_LABEL_CLASSES = "mb-1 text-[0.7rem] font-semibold text-foreground-subtle uppercase";

type BashToolContentProps = {
	call: ToolCallWithResult;
};

export function BashToolContent({ call }: BashToolContentProps) {
	const command = String(call.input["command"] || "");

	return (
		<>
			<div className="mb-2">
				<div className={SECTION_LABEL_CLASSES}>Command</div>
				<CodeBox language="bash">{command}</CodeBox>
			</div>
			<SmartToolOutput output={call.result} isError={call.isError} resultImages={call.resultImages} />
		</>
	);
}
