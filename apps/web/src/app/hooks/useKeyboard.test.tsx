import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useKeyboard } from "./useKeyboard.ts";

// Wrapper component that uses the hook
function KeyboardTestHarness(props: {
  handlers: Parameters<typeof useKeyboard>[0];
  active: boolean;
}) {
  useKeyboard(props.handlers, props.active);
  return <div>Keyboard test</div>;
}

function fireKey(key: string, opts: KeyboardEventInit = {}) {
  // Dispatch directly on window since the hook listens on window
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

describe("useKeyboard", () => {
  test("calls onNext for ArrowRight", () => {
    const onNext = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onNext }} active />);
    fireKey("ArrowRight");
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test("calls onNext for Space", () => {
    const onNext = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onNext }} active />);
    fireKey(" ");
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test("calls onPrev for ArrowLeft", () => {
    const onPrev = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onPrev }} active />);
    fireKey("ArrowLeft");
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  test("calls onNextTurn for ArrowDown", () => {
    const onNextTurn = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onNextTurn }} active />);
    fireKey("ArrowDown");
    expect(onNextTurn).toHaveBeenCalledTimes(1);
  });

  test("calls onPrevTurn for ArrowUp", () => {
    const onPrevTurn = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onPrevTurn }} active />);
    fireKey("ArrowUp");
    expect(onPrevTurn).toHaveBeenCalledTimes(1);
  });

  test("calls onEscape for Escape", () => {
    const onEscape = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onEscape }} active />);
    fireKey("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test("calls onFullscreen for 'f' key (no modifier)", () => {
    const onFullscreen = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onFullscreen }} active />);
    fireKey("f");
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  test("does NOT call onFullscreen for Ctrl+f", () => {
    const onFullscreen = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onFullscreen }} active />);
    fireKey("f", { ctrlKey: true });
    expect(onFullscreen).toHaveBeenCalledTimes(0);
  });

  test("does NOT call onFullscreen for Cmd+f", () => {
    const onFullscreen = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onFullscreen }} active />);
    fireKey("f", { metaKey: true });
    expect(onFullscreen).toHaveBeenCalledTimes(0);
  });

  test("does nothing when active is false", () => {
    const onNext = mock(() => {});
    const onPrev = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onNext, onPrev }} active={false} />);
    fireKey("ArrowRight");
    fireKey("ArrowLeft");
    expect(onNext).toHaveBeenCalledTimes(0);
    expect(onPrev).toHaveBeenCalledTimes(0);
  });

  test("does not fire for unrelated keys", () => {
    const onNext = mock(() => {});
    const onPrev = mock(() => {});
    const onEscape = mock(() => {});
    render(<KeyboardTestHarness handlers={{ onNext, onPrev, onEscape }} active />);
    fireKey("a");
    fireKey("Enter");
    fireKey("Tab");
    expect(onNext).toHaveBeenCalledTimes(0);
    expect(onPrev).toHaveBeenCalledTimes(0);
    expect(onEscape).toHaveBeenCalledTimes(0);
  });

  test("missing handlers are safely skipped", () => {
    render(<KeyboardTestHarness handlers={{}} active />);
    // Should not throw when a handler is undefined
    fireKey("ArrowRight");
    fireKey("ArrowLeft");
    fireKey("Escape");
    fireKey("f");
    // No error = pass
  });

  test("cleans up listener on unmount", () => {
    const onNext = mock(() => {});
    const { unmount } = render(<KeyboardTestHarness handlers={{ onNext }} active />);
    unmount();
    fireKey("ArrowRight");
    expect(onNext).toHaveBeenCalledTimes(0);
  });

  test("ignores keydown when target is an input element", () => {
    const onNext = mock(() => {});
    const { container } = render(
      <div>
        <input type="text" data-testid="input" />
        <KeyboardTestHarness handlers={{ onNext }} active />
      </div>,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(input, { key: " " });
    expect(onNext).toHaveBeenCalledTimes(0);
  });

  test("ignores keydown when target is a textarea element", () => {
    const onNext = mock(() => {});
    const { container } = render(
      <div>
        <textarea data-testid="textarea" />
        <KeyboardTestHarness handlers={{ onNext }} active />
      </div>,
    );
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(0);
  });
});
