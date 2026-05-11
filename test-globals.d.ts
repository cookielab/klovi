declare global {
	const test: typeof import("bun:test").test;
	const it: typeof import("bun:test").it;
	const describe: typeof import("bun:test").describe;
	const expect: typeof import("bun:test").expect;
	const beforeAll: typeof import("bun:test").beforeAll;
	const beforeEach: typeof import("bun:test").beforeEach;
	const afterEach: typeof import("bun:test").afterEach;
	const afterAll: typeof import("bun:test").afterAll;
	const mock: typeof import("bun:test").mock;
	const spyOn: typeof import("bun:test").spyOn;
}

export {};
