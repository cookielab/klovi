import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SmartToolOutput } from "./SmartToolOutput.tsx";

// biome-ignore lint/security/noSecrets: CSS selector, not a secret
const LIGHTBOX_SELECTOR = "[role='presentation']";

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
    expect(container.textContent).toContain("file1.txt");
    // Plain text output should NOT be syntax highlighted (no pre > code)
    // It should be in a div with the raw text
    const preElements = container.querySelectorAll("pre code");
    expect(preElements.length).toBe(0);
  });

  test("highlights JSON output", () => {
    const { container } = render(<SmartToolOutput output='{"name": "test"}' isError={false} />);
    // JSON output gets syntax highlighting via CodeBlock/CodeBox — uses pre > code
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
  });

  test("highlights diff output", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;
    const { container } = render(<SmartToolOutput output={diff} isError={false} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
  });

  test("shows error styling for error output", () => {
    const { container } = render(<SmartToolOutput output="command not found" isError={true} />);
    expect(container.textContent).toContain("command not found");
  });

  test("error output uses plain text even if format detected", () => {
    const { container } = render(<SmartToolOutput output='{"error": "failed"}' isError={true} />);
    expect(container.textContent).toContain('{"error": "failed"}');
    // Error output should NOT use syntax highlighting
    const pre = container.querySelector("pre");
    expect(pre).toBeNull();
  });

  test("shows truncation notice for long output", () => {
    const longOutput = "x".repeat(6000);
    const { getByText } = render(<SmartToolOutput output={longOutput} isError={false} />);
    expect(getByText("... (truncated)")).toBeTruthy();
  });

  test("no truncation notice for short output", () => {
    const { queryByText } = render(<SmartToolOutput output="short" isError={false} />);
    expect(queryByText("... (truncated)")).toBeNull();
  });

  test("renders result images", () => {
    const { container } = render(
      <SmartToolOutput
        output="some output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  test("renders images even without text output", () => {
    const { container } = render(
      <SmartToolOutput
        output=""
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  test("shows Output label", () => {
    const { getByText } = render(<SmartToolOutput output="hello" isError={false} />);
    expect(getByText("Output")).toBeTruthy();
  });

  test("clicking an image opens the lightbox", () => {
    const { container, getByAltText } = render(
      <SmartToolOutput
        output="output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );

    // No lightbox initially
    expect(container.querySelector(LIGHTBOX_SELECTOR)).toBeNull();

    const img = getByAltText("Tool result 1");
    expect(img).not.toBeNull();
    fireEvent.click(img);

    const overlay = container.querySelector(LIGHTBOX_SELECTOR);
    expect(overlay).not.toBeNull();

    const lightboxImg = getByAltText("Full size preview") as HTMLImageElement;
    expect(lightboxImg.src).toBe("data:image/png;base64,AAAA");
  });

  test("lightbox closes on overlay click", () => {
    const { container, getByAltText } = render(
      <SmartToolOutput
        output="output"
        isError={false}
        resultImages={[{ mediaType: "image/png", data: "AAAA" }]}
      />,
    );

    // Open lightbox
    const toolImg = getByAltText("Tool result 1");
    expect(toolImg).not.toBeNull();
    fireEvent.click(toolImg);
    expect(container.querySelector(LIGHTBOX_SELECTOR)).not.toBeNull();

    // Click overlay to close
    const overlay = container.querySelector(LIGHTBOX_SELECTOR);
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);

    // The lightbox state clears after the 200ms setTimeout
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(container.querySelector(LIGHTBOX_SELECTOR)).toBeNull();
        resolve();
      }, 250);
    });
  });
});
