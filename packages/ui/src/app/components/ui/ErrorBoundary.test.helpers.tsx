import { Text } from "@cookielab.io/klovi-design-system";
import { T_SAFE_CONTENT } from "./ErrorBoundary.test.constants";

type MaybeThrowProps = {
	shouldThrowRef: { current: boolean };
	recoveredText: string;
};

export function ThrowingComponent({ message }: { message: string }): never {
	throw new Error(message);
}

export function SafeComponent(): React.ReactNode {
	return (
		<div>
			<Text>{T_SAFE_CONTENT}</Text>
		</div>
	);
}

export function MaybeThrow({ shouldThrowRef, recoveredText }: MaybeThrowProps): React.JSX.Element {
	if (shouldThrowRef.current === true) {
		throw new Error("boom");
	}
	return (
		<div>
			<Text>{recoveredText}</Text>
		</div>
	);
}
