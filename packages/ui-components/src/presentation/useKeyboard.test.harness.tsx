import { Text } from "@cookielab.io/klovi-design-system";
import type { useKeyboard } from "./useKeyboard";
import { useKeyboard as useKeyboardHook } from "./useKeyboard";
import { T_KEYBOARD_HARNESS } from "./useKeyboard.test.helpers";

export function KeyboardHarness(props: {
	handlers: Parameters<typeof useKeyboard>[0];
	active: boolean;
}): React.ReactNode {
	useKeyboardHook(props.handlers, props.active);
	return (
		<div>
			<Text>{T_KEYBOARD_HARNESS}</Text>
		</div>
	);
}
