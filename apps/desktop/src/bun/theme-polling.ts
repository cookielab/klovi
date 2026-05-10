import type { CommandExecutor } from "@effect/platform";
import { Effect, Ref, Schedule } from "effect";
import { detectLinuxSystemTheme, type SystemTheme } from "./linux-runtime";

type ThemeChangeCallback = (theme: SystemTheme) => void;

/**
 * Poll the Linux system theme every 5 seconds; invoke `onChange` only when the
 * detected theme differs from the previously emitted value.
 *
 * Returns an Effect that, when forked, runs until interrupted. The caller is
 * responsible for scoping the fiber lifetime (e.g. via ManagedRuntime disposal).
 */
const makeThemePollingFiber = (
	onChange: ThemeChangeCallback,
): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
	Effect.gen(function* () {
		const lastTheme = yield* Ref.make<SystemTheme | null>(null);

		const tick = Effect.gen(function* () {
			const theme = yield* detectLinuxSystemTheme();
			if (theme === null) {
				return;
			}
			const previous = yield* Ref.get(lastTheme);
			if (theme !== previous) {
				yield* Ref.set(lastTheme, theme);
				yield* Effect.sync(() => {
					onChange(theme);
				});
			}
		});

		yield* Effect.schedule(tick, Schedule.spaced("5 seconds"));
	});

export type { ThemeChangeCallback };
export { makeThemePollingFiber };
