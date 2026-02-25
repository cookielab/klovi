import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { ImageLightbox } from "./ImageLightbox.tsx";

// Stub rAF to run callbacks synchronously so the component transitions immediately.
let origRAF: typeof globalThis.requestAnimationFrame;
beforeEach(() => {
  origRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});
afterEach(() => {
  globalThis.requestAnimationFrame = origRAF;
  cleanup();
});

describe("ImageLightbox", () => {
  test("renders overlay and image with correct src and alt", () => {
    const onClose = mock(() => {});
    const { getByRole, getByAltText } = render(
      <ImageLightbox src="data:image/png;base64,AAAA" onClose={onClose} />,
    );

    const overlay = getByRole("presentation");
    expect(overlay).not.toBeNull();

    const img = getByAltText("Full size preview") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe("data:image/png;base64,AAAA");
  });

  test("calls onClose on overlay click after timeout", () => {
    const onClose = mock(() => {});
    const { getByRole } = render(<ImageLightbox src="test.png" onClose={onClose} />);

    const overlay = getByRole("presentation");
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // onClose is called via setTimeout(onClose, 200), so not yet called
    expect(onClose).not.toHaveBeenCalled();

    // Wait for the 200ms setTimeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
        resolve();
      }, 250);
    });
  });

  test("calls onClose on Escape key", () => {
    const onClose = mock(() => {});
    render(<ImageLightbox src="test.png" onClose={onClose} />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
        resolve();
      }, 250);
    });
  });

  test("does not call onClose on other keys", () => {
    const onClose = mock(() => {});
    render(<ImageLightbox src="test.png" onClose={onClose} />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onClose).not.toHaveBeenCalled();
        resolve();
      }, 250);
    });
  });

  test("cleans up keydown listener on unmount", () => {
    const onClose = mock(() => {});
    const { unmount } = render(<ImageLightbox src="test.png" onClose={onClose} />);

    unmount();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onClose).not.toHaveBeenCalled();
        resolve();
      }, 250);
    });
  });
});
