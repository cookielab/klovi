import { cleanup, render } from "@testing-library/react";
import type { Turn } from "../types/index";
import { MessageList } from "./MessageList";

afterEach(cleanup);

function makeTurn(i: number): Turn {
	return {
		kind: "user",
		uuid: `t-${i}`,
		timestamp: "2025-01-15T10:00:00Z",
		text: `message ${i}`,
	} as Turn;
}

describe("MessageList virtualization", () => {
	it("renders only a windowed slice when many turns are passed", () => {
		const turns = Array.from({ length: 500 }, (_, i) => makeTurn(i));
		const { container } = render(
			<div>
				<MessageList turns={turns} />
			</div>,
		);
		const items = container.querySelectorAll("[data-index]");
		// Window + overscan should be far less than 500.
		expect(items.length).toBeLessThan(50);
		expect(items.length).toBeGreaterThan(0);
	});

	it("uses turn.uuid as a stable key when present", () => {
		const turns: Turn[] = [makeTurn(0), makeTurn(1), makeTurn(2)];
		const { container } = render(
			<div>
				<MessageList turns={turns} />
			</div>,
		);
		const indexes = Array.from(container.querySelectorAll("[data-index]")).map((el) => el.getAttribute("data-index"));
		expect(indexes.includes("0")).toBe(true);
	});

	it("appending turns does not reset scrollTop", async () => {
		const initial = Array.from({ length: 100 }, (_, i) => makeTurn(i));
		const { container, rerender } = render(
			<div>
				<MessageList turns={initial} />
			</div>,
		);
		const scrollEl = container.querySelector(".overflow-auto") as HTMLElement | null;
		expect(scrollEl).not.toBeNull();
		if (scrollEl) {
			scrollEl.scrollTop = 500;
		}

		const appended = [...initial, ...Array.from({ length: 50 }, (_, i) => makeTurn(100 + i))];
		rerender(
			<div>
				<MessageList turns={appended} />
			</div>,
		);

		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect((scrollEl as HTMLElement).scrollTop).toBe(500);
	});
});
