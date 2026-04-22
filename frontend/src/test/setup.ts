export {};

import { describe, expect, it } from "vitest";

Object.assign(globalThis, {
  describe,
  expect,
  it
});

await import("@testing-library/jest-dom/vitest");
