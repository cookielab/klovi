import { Text } from "@cookielab.io/klovi-design-system";
import { fireEvent, render } from "@testing-library/react";
import { useKeyboard } from "./useKeyboard";


const T_KEYBOARD_TEST = "Keyboard test";

function KeyboardTestHarness(props: { handlers: Parameters<typeof useKeyboard>[0]; active: boolean }): React.ReactNode {
	useKeyboard(props.handlers, props.active);
	return <div><Text>{T_KEYBOARD_TEST}</Text></div>;
}

function fireKey(key: string, opts: KeyboardEventInit = {}): void {
	// Dispatch directly on window since the hook listens on window
	globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: key, bubbles: true, ...opts }));
}

describe("useKeyboard", () => {
	it("calls onNext for ArrowRight", () => {
		const onNext = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onNext: onNext }} active={true} />);
		fireKey("ArrowRight");
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("calls onNext for Space", () => {
		const onNext = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onNext: onNext }} active={true} />);
		fireKey(" ");
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("calls onPrev for ArrowLeft", () => {
		const onPrev = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onPrev: onPrev }} active={true} />);
		fireKey("ArrowLeft");
		expect(onPrev).toHaveBeenCalledTimes(1);
	});

	it("calls onNextTurn for ArrowDown", () => {
		const onNextTurn = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onNextTurn: onNextTurn }} active={true} />);
		fireKey("ArrowDown");
		expect(onNextTurn).toHaveBeenCalledTimes(1);
	});

	it("calls onPrevTurn for ArrowUp", () => {
		const onPrevTurn = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onPrevTurn: onPrevTurn }} active={true} />);
		fireKey("ArrowUp");
		expect(onPrevTurn).toHaveBeenCalledTimes(1);
	});

	it("calls onEscape for Escape", () => {
		const onEscape = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onEscape: onEscape }} active={true} />);
		fireKey("Escape");
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("calls onFullscreen for 'f' key (no modifier)", () => {
		const onFullscreen = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onFullscreen: onFullscreen }} active={true} />);
		fireKey("f");
		expect(onFullscreen).toHaveBeenCalledTimes(1);
	});

	it("does NOT call onFullscreen for Ctrl+f", () => {
		const onFullscreen = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onFullscreen: onFullscreen }} active={true} />);
		fireKey("f", { ctrlKey: true });
		expect(onFullscreen).toHaveBeenCalledTimes(0);
	});

	it("does NOT call onFullscreen for Cmd+f", () => {
		const onFullscreen = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onFullscreen: onFullscreen }} active={true} />);
		fireKey("f", { metaKey: true });
		expect(onFullscreen).toHaveBeenCalledTimes(0);
	});

	it("does nothing when active is false", () => {
		const onNext = mock(() => undefined);
		const onPrev = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onNext: onNext, onPrev: onPrev }} active={false} />);
		fireKey("ArrowRight");
		fireKey("ArrowLeft");
		expect(onNext).toHaveBeenCalledTimes(0);
		expect(onPrev).toHaveBeenCalledTimes(0);
	});

	it("does not fire for unrelated keys", () => {
		const onNext = mock(() => undefined);
		const onPrev = mock(() => undefined);
		const onEscape = mock(() => undefined);
		render(<KeyboardTestHarness handlers={{ onNext: onNext, onPrev: onPrev, onEscape: onEscape }} active={true} />);
		fireKey("a");
		fireKey("Enter");
		fireKey("Tab");
		expect(onNext).toHaveBeenCalledTimes(0);
		expect(onPrev).toHaveBeenCalledTimes(0);
		expect(onEscape).toHaveBeenCalledTimes(0);
	});

	it("missing handlers are safely skipped", () => {
		const { container } = render(<KeyboardTestHarness handlers={{}} active={true} />);
		// Should not throw when a handler is undefined
		fireKey("ArrowRight");
		fireKey("ArrowLeft");
		fireKey("Escape");
		fireKey("f");
		expect(container).toBeTruthy();
	});

	it("cleans up listener on unmount", () => {
		const onNext = mock(() => undefined);
		const { unmount } = render(<KeyboardTestHarness handlers={{ onNext: onNext }} active={true} />);
		unmount();
		fireKey("ArrowRight");
		expect(onNext).toHaveBeenCalledTimes(0);
	});

	it("ignores keydown when target is an input element", () => {
		const onNext = mock(() => undefined);
		const { container } = render(
			<div>
				<input type="text" data-testid="input" />
				<KeyboardTestHarness handlers={{ onNext: onNext }} active={true} />
			</div>,
		);
		const input = container.querySelector("input") as HTMLInputElement;
		fireEvent.keyDown(input, { key: "ArrowRight" });
		fireEvent.keyDown(input, { key: " " });
		expect(onNext).toHaveBeenCalledTimes(0);
	});

	it("ignores keydown when target is a textarea element", () => {
		const onNext = mock(() => undefined);
		const { container } = render(
			<div>
				<textarea data-testid="textarea" />
				<KeyboardTestHarness handlers={{ onNext: onNext }} active={true} />
			</div>,
		);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.keyDown(textarea, { key: "ArrowRight" });
		expect(onNext).toHaveBeenCalledTimes(0);
	});
});
