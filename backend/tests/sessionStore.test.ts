import { mkdtemp, readFile, rm, utimes } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionStore } from "../src/storage/sessionStore.js";

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

  it("uses the documented session id and filename contract", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });
    const mockedRandomUUID = vi.mocked(randomUUID);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    mockedRandomUUID.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");

    const session = await store.create();

    expect(session.id).toBe("2024-01-01T00-00-00-550e8400-e29b-41d4-a716-446655440000");
    expect(session.id).not.toContain(".000Z");
    expect(session.id).not.toContain("000000");
    expect(await readFile(join(testDir, `${session.id}.json`), "utf8")).toContain(
      `"id": "${session.id}"`
    );
  });

  it("lists sessions in reverse chronological order", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });
    vi.useFakeTimers();
    const firstCreatedAt = new Date("2024-01-01T00:00:00.000Z");
    const secondCreatedAt = new Date("2024-01-01T00:00:01.000Z");

    vi.setSystemTime(firstCreatedAt);

    const first = await store.create();
    vi.setSystemTime(secondCreatedAt);
    const second = await store.create();
    const sessions = await store.list();

    expect(sessions.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);
  });

  it("orders same-timestamp sessions after a restart by persisted file metadata", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const store = createSessionStore({ sessionsDir: testDir });
    const mockedRandomUUID = vi.mocked(randomUUID);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    mockedRandomUUID
      .mockReturnValueOnce("ffffffff-ffff-4fff-8fff-ffffffffffff")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000000");
    const firstMtime = new Date("2024-01-01T00:00:00.000Z");
    const secondMtime = new Date("2024-01-01T00:00:01.000Z");

    const first = await store.create();
    const second = await store.create();
    await utimes(join(testDir, `${first.id}.json`), firstMtime, firstMtime);
    await utimes(join(testDir, `${second.id}.json`), secondMtime, secondMtime);
    vi.resetModules();
    const { createSessionStore: freshCreateSessionStore } = await import(
      "../src/storage/sessionStore.js"
    );
    const sessions = await freshCreateSessionStore({ sessionsDir: testDir }).list();

    expect(sessions.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);
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
