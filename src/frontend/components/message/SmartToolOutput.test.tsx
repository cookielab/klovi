import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

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

describe("SmartToolOutput", () => {
  test("returns null when no output and no images", () => {
    const { container } = render(<SmartToolOutput output="" isError={false} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders plain text for unrecognized output", () => {
    const { container } = render(<SmartToolOutput output="file1.txt\nfile2.txt" isError={false} />);
    expect(container.querySelector(".tool-call-output")).not.toBeNull();
    expect(container.querySelector(".code-block-wrapper")).toBeNull();
  });

  test("highlights JSON output", () => {
    const { container } = render(<SmartToolOutput output='{"name": "test"}' isError={false} />);
    const codeBlocks = container.querySelectorAll(".code-block-wrapper");
    expect(codeBlocks.length).toBe(1);
  });

  test("highlights diff output", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
    const { container } = render(<SmartToolOutput output={diff} isError={false} />);
    expect(container.querySelector(".code-block-wrapper")).not.toBeNull();
  });

  test("shows error styling for error output", () => {
    const { container } = render(<SmartToolOutput output="command not found" isError={true} />);
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
  });

  test("error output uses plain text even if format detected", () => {
    const { container } = render(<SmartToolOutput output='{"error": "failed"}' isError={true} />);
    expect(container.querySelector(".tool-call-error")).not.toBeNull();
    expect(container.querySelector(".code-block-wrapper")).toBeNull();
  });

  test("shows truncation notice for long output", () => {
    const longOutput = "x".repeat(6000);
    const { container } = render(<SmartToolOutput output={longOutput} isError={false} />);
    expect(container.querySelector(".tool-call-truncated")).not.toBeNull();
  });

  test("no truncation notice for short output", () => {
    const { container } = render(<SmartToolOutput output="short" isError={false} />);
    expect(container.querySelector(".tool-call-truncated")).toBeNull();
  });

  test("renders result images", () => {
    const { container } = render(
      <SmartToolOutput
        output="some output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });

  test("renders images even without text output", () => {
    const { container } = render(
      <SmartToolOutput
        output=""
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll(".tool-result-image");
    expect(images.length).toBe(1);
  });

  test("shows Output label", () => {
    const { container } = render(<SmartToolOutput output="hello" isError={false} />);
    const label = container.querySelector(".tool-section-label");
    expect(label?.textContent).toBe("Output");
  });

  test("clicking an image opens the lightbox", () => {
    const { container } = render(
      <SmartToolOutput
        output="output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );

    expect(container.querySelector(".lightbox-overlay")).toBeNull();

    const img = container.querySelector(".tool-result-image");
    expect(img).not.toBeNull();
    fireEvent.click(img as Element);

    const overlay = container.querySelector(".lightbox-overlay");
    expect(overlay).not.toBeNull();

    const lightboxImg = container.querySelector(".lightbox-image") as HTMLImageElement;
    expect(lightboxImg.src).toBe("data:image/png;base64,AAAA");
  });

  test("lightbox closes on overlay click", () => {
    const { container } = render(
      <SmartToolOutput
        output="output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );

    // Open lightbox
    const toolImg = container.querySelector(".tool-result-image");
    expect(toolImg).not.toBeNull();
    fireEvent.click(toolImg as Element);
    expect(container.querySelector(".lightbox-overlay")).not.toBeNull();

    // Click overlay to close
    const overlay = container.querySelector(".lightbox-overlay");
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);

    // The lightbox state clears after the 200ms setTimeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(container.querySelector(".lightbox-overlay")).toBeNull();
        resolve();
      }, 250);
    });
  });
});
