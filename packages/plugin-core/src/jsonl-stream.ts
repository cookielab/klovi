import { FileSystem, type Error as PlatformError } from "@effect/platform";
import { Effect, Ref, Stream } from "effect";

type JsonlLineContext = {
	parsed: unknown;
	line: string;
	lineIndex: number;
	lineNumber: number;
};

type JsonlVisitor = (context: JsonlLineContext) => unknown;

type StreamJsonlHeadOptions = {
	maxLines?: number;
	chunkSize?: number;
	onMalformed?: (line: string, lineNumber: number, error: unknown) => void;
};

type LineProcessorState = {
	visitor: JsonlVisitor;
	indexRef: Ref.Ref<number>;
	bailedRef: Ref.Ref<boolean>;
	onMalformed: StreamJsonlHeadOptions["onMalformed"];
};

const KILOBYTE_BYTES = 1024;
const DEFAULT_HEAD_CHUNK_KILOBYTES = 8;
const DEFAULT_HEAD_CHUNK_SIZE = DEFAULT_HEAD_CHUNK_KILOBYTES * KILOBYTE_BYTES;

function processLine(line: string, state: LineProcessorState): Effect.Effect<void> {
	return Effect.gen(function* () {
		if (yield* Ref.get(state.bailedRef)) {
			return;
		}
		const lineIndex = yield* Ref.getAndUpdate(state.indexRef, (n) => n + 1);
		if (!line.trim()) {
			return;
		}
		const lineNumber = lineIndex + 1;
		try {
			const parsed = JSON.parse(line);
			const result = state.visitor({ parsed: parsed, line: line, lineIndex: lineIndex, lineNumber: lineNumber });
			if (result === false) {
				yield* Ref.set(state.bailedRef, true);
			}
		} catch (error) {
			state.onMalformed?.(line, lineNumber, error);
		}
	});
}

function streamJsonlHead(
	filePath: string,
	visitor: JsonlVisitor,
	options: StreamJsonlHeadOptions = {},
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const indexRef = yield* Ref.make(0);
		const bailedRef = yield* Ref.make(false);
		const chunkSize = options.chunkSize ?? DEFAULT_HEAD_CHUNK_SIZE;

		const baseStream = fs.stream(filePath, { chunkSize: chunkSize });
		const linesStream = baseStream.pipe(Stream.decodeText("utf-8"), Stream.splitLines);
		const cappedStream = options.maxLines === undefined ? linesStream : linesStream.pipe(Stream.take(options.maxLines));

		const state: LineProcessorState = {
			visitor: visitor,
			indexRef: indexRef,
			bailedRef: bailedRef,
			onMalformed: options.onMalformed,
		};

		yield* cappedStream.pipe(
			Stream.takeUntilEffect(() => Ref.get(bailedRef)),
			Stream.runForEach((line) => processLine(line, state)),
		);
	});
}

export type { JsonlLineContext, JsonlVisitor, StreamJsonlHeadOptions };
export { streamJsonlHead };
