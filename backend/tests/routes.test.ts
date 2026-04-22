import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
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
};

const request = createRequire(import.meta.url)("supertest") as (app: Express) => RequestLike;
const listModels = vi.fn();
let testDir = "";

vi.mock("../src/ollama/client.js", () => ({
  createOllamaClient: () => ({
    listModels
  })
}));

describe("backend routes", () => {
  beforeEach(() => {
    listModels.mockReset();
  });

  it("lists and creates sessions", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });

    const initialResponse = await request(app).get("/backend/sessions");
    const createdResponse = await request(app).post("/backend/sessions");
    const finalResponse = await request(app).get("/backend/sessions");

    expect(initialResponse.status).toBe(200);
    expect(initialResponse.body).toEqual({ sessions: [] });
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.body).toMatchObject({
      endpoint: "/api/chat",
      model: "",
      stream: true
    });
    expect(finalResponse.status).toBe(200);
    const createdBody = createdResponse.body as SessionResponseBody;
    const finalBody = finalResponse.body as SessionsResponseBody;

    expect(finalBody.sessions).toHaveLength(1);
    expect(finalBody.sessions[0].id).toBe(createdBody.id);
  });

  it("returns backend health", async () => {
    const app = createApp({ sessionsDir: "sessions", ollamaBaseUrl: "http://127.0.0.1:11434" });
    const response = await request(app).get("/backend/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns normalized models", async () => {
    listModels.mockResolvedValue([{ name: "llama3.1:8b" }]);
    const app = createApp({ sessionsDir: "sessions", ollamaBaseUrl: "http://127.0.0.1:11434" });

    const response = await request(app).get("/backend/ollama/models");

    expect(response.status).toBe(200);
    const body = response.body as { models: Array<{ name: string }> };
    expect(body.models).toEqual([{ name: "llama3.1:8b" }]);
  });
});

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = "";
  }
});
