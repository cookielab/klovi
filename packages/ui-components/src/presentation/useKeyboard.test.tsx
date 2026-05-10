import { Text } from "@cookielab.io/klovi-design-system";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useKeyboard } from "./useKeyboard";


const T_KEYBOARD_HARNESS = "keyboard harness";

function KeyboardHarness(props: { handlers: Parameters<typeof useKeyboard>[0]; active: boolean }): React.ReactNode {
	useKeyboard(props.handlers, props.active);
	return <div><Text>{T_KEYBOARD_HARNESS}</Text></div>;
}

function fireKey(key: string, opts: KeyboardEventInit = {}): void {
	globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, ...opts }));
}

afterEach(cleanup);

describe("useKeyboard", () => {
	it("maps arrow and space keys to step handlers", () => {
		const onNext = mock(() => undefined);
		const onPrev = mock(() => undefined);
		const onNextTurn = mock(() => undefined);
		const onPrevTurn = mock(() => undefined);

		render(
			<KeyboardHarness
				active={true}
				handlers={{ onNext: onNext, onPrev: onPrev, onNextTurn: onNextTurn, onPrevTurn: onPrevTurn }}
			/>,
		);

		fireKey("ArrowRight");
		fireKey(" ");
		fireKey("ArrowLeft");
		fireKey("ArrowDown");
		fireKey("ArrowUp");

		expect(onNext).toHaveBeenCalledTimes(2);
		expect(onPrev).toHaveBeenCalledTimes(1);
		expect(onNextTurn).toHaveBeenCalledTimes(1);
		expect(onPrevTurn).toHaveBeenCalledTimes(1);
	});

	it("handles escape and fullscreen shortcuts", () => {
		const onEscape = mock(() => undefined);
		const onFullscreen = mock(() => undefined);

		render(<KeyboardHarness active={true} handlers={{ onEscape: onEscape, onFullscreen: onFullscreen }} />);

		fireKey("Escape");
		fireKey("f");
		fireKey("f", { ctrlKey: true });
		fireKey("f", { metaKey: true });

		expect(onEscape).toHaveBeenCalledTimes(1);
		expect(onFullscreen).toHaveBeenCalledTimes(1);
	});

	it("does nothing when inactive", () => {
		const onNext = mock(() => undefined);
		const onEscape = mock(() => undefined);

		render(<KeyboardHarness active={false} handlers={{ onNext: onNext, onEscape: onEscape }} />);

		fireKey("ArrowRight");
		fireKey("Escape");

		expect(onNext).toHaveBeenCalledTimes(0);
		expect(onEscape).toHaveBeenCalledTimes(0);
	});

	it("ignores key events from input and textarea", () => {
		const onNext = mock(() => undefined);

		const { container } = render(
			<div>
				<input type="text" />
				<textarea />
				<KeyboardHarness active={true} handlers={{ onNext: onNext }} />
			</div>,
		);

		const input = container.querySelector("input");
		const textarea = container.querySelector("textarea");
		if (!(input && textarea)) {
			throw new Error("input/textarea not rendered");
		}

		fireEvent.keyDown(input, { key: "ArrowRight" });
		fireEvent.keyDown(textarea, { key: "ArrowRight" });

		expect(onNext).toHaveBeenCalledTimes(0);
	});

	it("safely skips missing handlers and cleans up on unmount", () => {
		const onNext = mock(() => undefined);
		const { unmount } = render(<KeyboardHarness active={true} handlers={{ onNext: onNext }} />);

		unmount();
		fireKey("ArrowRight");

		expect(onNext).toHaveBeenCalledTimes(0);

		render(<KeyboardHarness active={true} handlers={{}} />);
		fireKey("ArrowRight");
		fireKey("Escape");
	});
});
