import type * as bunTest from "bun:test";

declare global {
	const afterAll: typeof bunTest.afterAll;
	const afterEach: typeof bunTest.afterEach;
	const beforeAll: typeof bunTest.beforeAll;
	const beforeEach: typeof bunTest.beforeEach;
	const describe: typeof bunTest.describe;
	const expect: typeof bunTest.expect;
	const it: typeof bunTest.it;
	const mock: typeof bunTest.mock;
	const spyOn: typeof bunTest.spyOn;
	const test: typeof bunTest.test;
}
