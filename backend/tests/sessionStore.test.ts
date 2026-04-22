import { mkdtemp, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionStore } from "../src/storage/sessionStore";

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomUUID: vi.fn(() => actual.randomUUID())
  };
});

let testDir = "";

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = "";
  }
});

describe("sessionStore", () => {
  it("creates and persists a new session", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });

    const session = await store.create();
    const savedText = await readFile(join(testDir, `${session.id}.json`), "utf8");

    expect(session.messages).toEqual([]);
    expect(JSON.parse(savedText).id).toBe(session.id);
  });

  it("lists sessions in reverse chronological order", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });

    const first = await store.create();
    const second = await store.create();
    const sessions = await store.list();

    expect(sessions.map((item) => item.id)).toEqual([second.id, first.id]);
  });

  it("orders same-timestamp sessions by creation order", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });
    const mockedRandomUUID = vi.mocked(randomUUID);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    mockedRandomUUID
      .mockReturnValueOnce("ffffffff-ffff-4fff-8fff-ffffffffffff")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000000");

    const first = await store.create();
    const second = await store.create();
    const sessions = await store.list();

    expect(sessions.map((item) => item.id)).toEqual([second.id, first.id]);
  });

  it("gives each new session a fresh derived_metrics object", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });

    const first = await store.create();
    const second = await store.create();

    first.derived_metrics.total_sec = 42;

    expect(second.derived_metrics.total_sec).toBeNull();
  });
});
