import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useKeyboard } from "./useKeyboard.ts";

function KeyboardHarness(props: { handlers: Parameters<typeof useKeyboard>[0]; active: boolean }) {
  useKeyboard(props.handlers, props.active);
  return <div>keyboard harness</div>;
}

function fireKey(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

afterEach(cleanup);

describe("useKeyboard", () => {
  test("maps arrow and space keys to step handlers", () => {
    const onNext = mock(() => {});
    const onPrev = mock(() => {});
    const onNextTurn = mock(() => {});
    const onPrevTurn = mock(() => {});

    render(<KeyboardHarness active handlers={{ onNext, onPrev, onNextTurn, onPrevTurn }} />);

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

  test("handles escape and fullscreen shortcuts", () => {
    const onEscape = mock(() => {});
    const onFullscreen = mock(() => {});

    render(<KeyboardHarness active handlers={{ onEscape, onFullscreen }} />);

    fireKey("Escape");
    fireKey("f");
    fireKey("f", { ctrlKey: true });
    fireKey("f", { metaKey: true });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  test("does nothing when inactive", () => {
    const onNext = mock(() => {});
    const onEscape = mock(() => {});

    render(<KeyboardHarness active={false} handlers={{ onNext, onEscape }} />);

    fireKey("ArrowRight");
    fireKey("Escape");

    expect(onNext).toHaveBeenCalledTimes(0);
    expect(onEscape).toHaveBeenCalledTimes(0);
  });

  test("ignores key events from input and textarea", () => {
    const onNext = mock(() => {});

    const { container } = render(
      <div>
        <input type="text" />
        <textarea />
        <KeyboardHarness active handlers={{ onNext }} />
      </div>,
    );

    const input = container.querySelector("input");
    const textarea = container.querySelector("textarea");
    if (!input || !textarea) throw new Error("input/textarea not rendered");

    fireEvent.keyDown(input, { key: "ArrowRight" });
    fireEvent.keyDown(textarea, { key: "ArrowRight" });

    expect(onNext).toHaveBeenCalledTimes(0);
  });

  test("safely skips missing handlers and cleans up on unmount", () => {
    const onNext = mock(() => {});
    const { unmount } = render(<KeyboardHarness active handlers={{ onNext }} />);

    unmount();
    fireKey("ArrowRight");

    expect(onNext).toHaveBeenCalledTimes(0);

    render(<KeyboardHarness active handlers={{}} />);
    fireKey("ArrowRight");
    fireKey("Escape");
  });
});
