export {};

const vitestModule = await import("vitest");

Object.assign(globalThis, {
  afterEach: vitestModule.afterEach,
  beforeEach: vitestModule.beforeEach,
  describe: vitestModule.describe,
  expect: vitestModule.expect,
  it: vitestModule.it,
  vi: vitestModule.vi
});

await import("@testing-library/jest-dom/vitest");
