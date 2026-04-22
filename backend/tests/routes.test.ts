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
  post(path: string): {
    send(body: unknown): PromiseLike<ResponseLike>;
  };
  delete(path: string): PromiseLike<ResponseLike>;
};

const request = createRequire(import.meta.url)("supertest") as (app: Express) => RequestLike;
const listModels = vi.fn();
const ping = vi.fn();
const runChat = vi.fn();
let testRootDir = "";
let testDir = "";

vi.mock("../src/ollama/client.js", () => ({
  createOllamaClient: () => ({
    listModels,
    ping,
    runChat
  })
}));

describe("backend routes", () => {
  beforeEach(() => {
    listModels.mockReset();
    ping.mockReset();
    runChat.mockReset();
  });

  it("lists creates fetches and deletes sessions", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);
    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });

    const initialResponse = await request(app).get("/backend/sessions");
    const createdResponse = await request(app).post("/backend/sessions").send({});
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

  it("runs non-streaming chat and persists a fresh request id per success", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;

    runChat.mockResolvedValueOnce({
      message: { role: "assistant", content: "Hello from Ollama" },
      total_duration: 1230000000,
      load_duration: 120000000,
      prompt_eval_count: 12,
      prompt_eval_duration: 240000000,
      eval_count: 8,
      eval_duration: 160000000
    });

    const firstRunResponse = await request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send({
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      });

    expect(firstRunResponse.status).toBe(200);
    expect(runChat).toHaveBeenCalledTimes(1);
    const runCall = vi.mocked(runChat).mock.calls[0]?.[0];
    const firstRunSession = firstRunResponse.body as {
      session: {
        runtime: {
          last_request_id: string | null;
          last_status: string;
        };
      };
    };

    expect(runCall).toMatchObject({
      model: "llama3.1",
      stream: false,
      messages: [
        {
          role: "user",
          content: "Say hello"
        }
      ],
      options: {
        num_predict: 32,
        temperature: 0.2
      }
    });
    expect(firstRunSession.session.runtime.last_request_id).toEqual(expect.any(String));
    expect(firstRunSession.session.runtime.last_status).toBe("completed");

    runChat.mockResolvedValueOnce({
      message: { role: "assistant", content: "Hello again" },
      total_duration: 2230000000,
      load_duration: 220000000,
      prompt_eval_count: 10,
      prompt_eval_duration: 200000000,
      eval_count: 9,
      eval_duration: 180000000
    });

    const secondRunResponse = await request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send({
        prompt: "Say hello again",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      });

    expect(secondRunResponse.status).toBe(200);
    expect(runChat).toHaveBeenCalledTimes(2);
    const secondRunSession = secondRunResponse.body as {
      session: {
        runtime: {
          last_request_id: string | null;
          last_status: string;
        };
      };
    };

    expect(secondRunSession.session.runtime.last_request_id).toEqual(expect.any(String));
    expect(secondRunSession.session.runtime.last_request_id).not.toBe(
      firstRunSession.session.runtime.last_request_id
    );
    expect(secondRunSession.session.runtime.last_status).toBe("completed");
    expect(secondRunResponse.body).toMatchObject({
      session: {
        id: createdBody.id,
        messages: [
          {
            role: "user",
            content: "Say hello"
          },
          {
            role: "assistant",
            content: "Hello from Ollama"
          },
          {
            role: "user",
            content: "Say hello again"
          },
          {
            role: "assistant",
            content: "Hello again"
          }
        ],
        last_request: {
          model: "llama3.1",
          stream: false,
          messages: [
            {
              role: "user",
              content: "Say hello"
            },
            {
              role: "assistant",
              content: "Hello from Ollama"
            },
            {
              role: "user",
              content: "Say hello again"
            }
          ],
          options: {
            num_predict: 32,
            temperature: 0.2
          }
        },
        last_response: {
          message: {
            role: "assistant",
            content: "Hello again"
          }
        },
        last_stats: {
          total_duration: 2230000000,
          load_duration: 220000000,
          prompt_eval_count: 10,
          prompt_eval_duration: 200000000,
          eval_count: 9,
          eval_duration: 180000000
        },
        derived_metrics: {
          total_sec: 2.23,
          load_sec: 0.22,
          prompt_tokens_per_sec: 50,
          eval_tokens_per_sec: 50
        },
        runtime: {
          last_status: "completed"
        }
      }
    });
  });

  it("rejects malformed run bodies before calling Ollama", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;

    const invalidBodies = [
      {
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      },
      {
        prompt: "",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      },
      {
        prompt: "Say hello",
        endpoint: "/api/generate",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      },
      {
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      },
      {
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: true,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      },
      {
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: "32",
          temperature: 0.2
        }
      },
      {
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: "0.2"
        }
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app).post(`/backend/sessions/${createdBody.id}/run`).send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid run request" });
    }

    expect(runChat).not.toHaveBeenCalled();
  });

  it("persists failed run diagnostics when Ollama throws", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;

    runChat.mockResolvedValueOnce({
      message: { role: "assistant", content: "Hello from Ollama" },
      total_duration: 1230000000,
      load_duration: 120000000,
      prompt_eval_count: 12,
      prompt_eval_duration: 240000000,
      eval_count: 8,
      eval_duration: 160000000
    });

    const requestBody = {
      prompt: "Say hello",
      endpoint: "/api/chat",
      model: "llama3.1",
      stream: false,
      request_options: {
        num_predict: 32,
        temperature: 0.2
      }
    };

    const successResponse = await request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send(requestBody);

    expect(successResponse.status).toBe(200);
    expect(runChat).toHaveBeenCalledTimes(1);
    const successfulRequestId = (
      successResponse.body as {
        session: {
          runtime: {
            last_request_id: string | null;
          };
        };
      }
    ).session.runtime.last_request_id;

    runChat.mockRejectedValueOnce(new Error("Ollama exploded"));

    const failedRunResponse = await request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send({
        prompt: "Say hello again",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      });

    expect(failedRunResponse.status).toBe(500);
    expect(failedRunResponse.body).toEqual({ error: "Ollama exploded" });
    expect(runChat).toHaveBeenCalledTimes(2);

    const savedSession = JSON.parse(await readFile(join(testDir, `${createdBody.id}.json`), "utf8")) as {
      last_request: unknown;
      last_response: unknown;
      last_stats: Record<string, unknown>;
      derived_metrics: {
        total_sec: number | null;
        load_sec: number | null;
        prompt_tokens_per_sec: number | null;
        eval_tokens_per_sec: number | null;
      };
      runtime: {
        last_status: string;
        last_request_id: string | null;
      };
    };

    expect(savedSession.last_request).toMatchObject({
      model: "llama3.1",
      stream: false,
      messages: [
        {
          role: "user",
          content: "Say hello"
        },
        {
          role: "assistant",
          content: "Hello from Ollama"
        },
        {
          role: "user",
          content: "Say hello again"
        }
      ],
      options: {
        num_predict: 32,
        temperature: 0.2
      }
    });
    expect(savedSession.last_response).toEqual({
      error: {
        name: "Error",
        message: "Ollama exploded"
      }
    });
    expect(savedSession.last_stats).toEqual({});
    expect(savedSession.derived_metrics).toEqual({
      total_sec: null,
      load_sec: null,
      prompt_tokens_per_sec: null,
      eval_tokens_per_sec: null
    });
    expect(savedSession.runtime.last_status).toBe("failed");
    expect(savedSession.runtime.last_request_id).toEqual(expect.any(String));
    expect(savedSession.runtime.last_request_id).not.toBe(successfulRequestId);
  });

  it("rejects encoded traversal ids on run without touching outside files", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const outsideFile = join(testRootDir, "outside.json");
    await writeFile(outsideFile, "outside", "utf8");

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });

    const response = await request(app).post("/backend/sessions/..%2Foutside/run").send({
      prompt: "test",
      endpoint: "/api/chat",
      model: "llama3.1",
      stream: false,
      request_options: {
        num_predict: 32,
        temperature: 0.2
      }
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid session id" });
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
