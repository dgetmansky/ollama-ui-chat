import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

type ResponseLike = {
  status: number;
  body: unknown;
};

type SessionResponseBody = {
  id: string;
  endpoint: string;
  model: string;
  stream: boolean;
};

type SessionsResponseBody = {
  sessions: Array<{
    id: string;
  }>;
};

type RequestLike = {
  get(path: string): PromiseLike<ResponseLike>;
  post(path: string): PromiseLike<ResponseLike>;
  delete(path: string): PromiseLike<ResponseLike>;
};

const request = createRequire(import.meta.url)("supertest") as (app: Express) => RequestLike;
const listModels = vi.fn();
const ping = vi.fn();
let testRootDir = "";
let testDir = "";

vi.mock("../src/ollama/client.js", () => ({
  createOllamaClient: () => ({
    listModels,
    ping
  })
}));

describe("backend routes", () => {
  beforeEach(() => {
    listModels.mockReset();
    ping.mockReset();
  });

  it("lists creates fetches and deletes sessions", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);
    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });

    const initialResponse = await request(app).get("/backend/sessions");
    const createdResponse = await request(app).post("/backend/sessions");
    const createdBody = createdResponse.body as SessionResponseBody;
    const fetchedResponse = await request(app).get(`/backend/sessions/${createdBody.id}`);
    const deletedResponse = await request(app).delete(`/backend/sessions/${createdBody.id}`);
    const finalResponse = await request(app).get("/backend/sessions");

    expect(initialResponse.status).toBe(200);
    expect(initialResponse.body).toEqual({ sessions: [] });
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body).toMatchObject({
      endpoint: "/api/chat",
      model: "",
      stream: true
    });
    expect(fetchedResponse.status).toBe(200);
    expect(fetchedResponse.body).toMatchObject({
      id: createdBody.id,
      endpoint: "/api/chat",
      model: "",
      stream: true
    });
    expect(deletedResponse.status).toBe(204);
    expect(finalResponse.status).toBe(200);
    const finalBody = finalResponse.body as SessionsResponseBody;

    expect(finalBody.sessions).toHaveLength(0);
  });

  it("returns backend health", async () => {
    const app = createApp({ sessionsDir: "sessions", ollamaBaseUrl: "http://127.0.0.1:11434" });
    const response = await request(app).get("/backend/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns a clean 404 for missing sessions", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);
    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });

    const response = await request(app).get("/backend/sessions/2026-04-22T21-14-02-12345678-1234-1234-1234-123456789abc");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Session not found" });
  });

  it("rejects encoded traversal ids before reading or deleting outside files", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const outsideFile = join(testRootDir, "outside.json");
    await writeFile(outsideFile, "outside", "utf8");

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const traversalPath = "/backend/sessions/..%2Foutside";

    const readResponse = await request(app).get(traversalPath);
    const deleteResponse = await request(app).delete(traversalPath);

    expect(readResponse.status).toBe(400);
    expect(readResponse.body).toEqual({ error: "Invalid session id" });
    expect(deleteResponse.status).toBe(400);
    expect(deleteResponse.body).toEqual({ error: "Invalid session id" });
    expect(await readFile(outsideFile, "utf8")).toBe("outside");
  });

  it("returns normalized models", async () => {
    listModels.mockResolvedValue([{ name: "llama3.1:8b" }]);
    const app = createApp({ sessionsDir: "sessions", ollamaBaseUrl: "http://127.0.0.1:11434" });

    const response = await request(app).get("/backend/ollama/models");

    expect(response.status).toBe(200);
    const body = response.body as { models: Array<{ name: string }> };
    expect(body.models).toEqual([{ name: "llama3.1:8b" }]);
  });

  it("pings ollama", async () => {
    ping.mockResolvedValue({ status: "ok" });
    const app = createApp({ sessionsDir: "sessions", ollamaBaseUrl: "http://127.0.0.1:11434" });

    const response = await request(app).get("/backend/ollama/ping");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

afterEach(async () => {
  if (testRootDir) {
    await rm(testRootDir, { recursive: true, force: true });
    testRootDir = "";
    testDir = "";
  }
});
