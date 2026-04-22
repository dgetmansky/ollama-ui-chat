// @ts-ignore - supertest is available at runtime in this workspace without bundled types.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const listModels = vi.fn();

vi.mock("../src/ollama/client.js", () => ({
  createOllamaClient: () => ({
    listModels
  })
}));

describe("backend routes", () => {
  beforeEach(() => {
    listModels.mockReset();
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
    expect(response.body.models).toEqual([{ name: "llama3.1:8b" }]);
  });
});
