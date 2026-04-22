export {};

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
});

await import("@testing-library/jest-dom/vitest");
