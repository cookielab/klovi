import { Text } from "@cookielab.io/klovi-design-system";
import type { useKeyboard } from "./useKeyboard";
import { useKeyboard as useKeyboardHook } from "./useKeyboard";
import { T_KEYBOARD_TEST } from "./useKeyboard.test.helpers";

export function KeyboardTestHarness(props: {
	handlers: Parameters<typeof useKeyboard>[0];
	active: boolean;
}): React.ReactNode {
	useKeyboardHook(props.handlers, props.active);
	return (
		<div>
			<Text>{T_KEYBOARD_TEST}</Text>
		</div>
	);
}
