import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createSessionStore } from "../src/storage/sessionStore";

let testDir = "";

afterEach(async () => {
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
});
