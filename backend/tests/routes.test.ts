import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createRunService } from "../src/services/runService.js";
import type { StoredSession } from "../src/types/session.js";

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
const runGenerate = vi.fn();
let testRootDir = "";
let testDir = "";

vi.mock("../src/ollama/client.js", () => ({
  createOllamaClient: () => ({
    listModels,
    ping,
    runChat,
    runGenerate
  })
}));

describe("backend routes", () => {
  beforeEach(() => {
    listModels.mockReset();
    ping.mockReset();
    runChat.mockReset();
    runGenerate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("supports generate mode and request abort", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;

    runGenerate.mockResolvedValueOnce({
      response: "Generated reply",
      total_duration: 3230000000,
      load_duration: 220000000,
      prompt_eval_count: 14,
      prompt_eval_duration: 280000000,
      eval_count: 11,
      eval_duration: 220000000
    });

    const runResponse = await request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send({
        prompt: "Build a prompt",
        endpoint: "/api/generate",
        model: "llama3.1:8b",
        stream: true,
        request_options: {
          num_predict: 32,
          temperature: 0.5
        }
      });
    const runResponseBody = runResponse.body as {
      session: {
        endpoint: string;
        runtime: {
          last_request_id: string | null;
        };
        messages: Array<{ role: string; content: string }>;
        last_response: Record<string, unknown>;
      };
    };

    expect(runResponse.status).toBe(200);
    expect(runGenerate).toHaveBeenCalledTimes(1);
    expect(runResponseBody.session.endpoint).toBe("/api/generate");
    expect(runResponseBody.session.runtime.last_request_id).toEqual(expect.any(String));
    expect(runResponseBody.session.messages).toEqual([
      {
        role: "user",
        content: "Build a prompt"
      },
      {
        role: "assistant",
        content: "Generated reply"
      }
    ]);
    expect(runResponseBody.session.last_response).toMatchObject({ response: "Generated reply" });

    const abortResponse = await request(app).post("/backend/requests/request-123/abort").send({});

    expect(abortResponse.status).toBe(404);
    expect(abortResponse.body).toEqual({ error: "Request not found" });
  });

  it("parses streamed generate NDJSON into a combined response", async () => {
    const { createOllamaClient } = await vi.importActual<typeof import("../src/ollama/client.js")>(
      "../src/ollama/client.js"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn(),
        text: vi.fn().mockResolvedValue(
          [
            JSON.stringify({ response: "Hello", done: false }),
            JSON.stringify({ response: " world", done: false }),
            JSON.stringify({
              response: "",
              done: true,
              total_duration: 123,
              load_duration: 45,
              prompt_eval_count: 2,
              prompt_eval_duration: 6,
              eval_count: 3,
              eval_duration: 9
            })
          ].join("\n")
        )
      })
    );

    const client = createOllamaClient({ baseUrl: "http://127.0.0.1:11434" });
    const response = await client.runGenerate({
      model: "llama3.1",
      stream: true
    });

    expect(response).toMatchObject({
      response: "Hello world",
      total_duration: 123,
      load_duration: 45,
      prompt_eval_count: 2,
      prompt_eval_duration: 6,
      eval_count: 3,
      eval_duration: 9
    });
  });

  it("salvages streamed generate output when malformed lines appear after valid chunks", async () => {
    const { createOllamaClient } = await vi.importActual<typeof import("../src/ollama/client.js")>(
      "../src/ollama/client.js"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn(),
        text: vi.fn().mockResolvedValue(
          [
            JSON.stringify({ response: "Hello", done: false }),
            "not-json",
            JSON.stringify({
              response: " world",
              done: true,
              total_duration: 123,
              load_duration: 45,
              prompt_eval_count: 2,
              prompt_eval_duration: 6,
              eval_count: 3,
              eval_duration: 9
            })
          ].join("\n")
        )
      })
    );

    const client = createOllamaClient({ baseUrl: "http://127.0.0.1:11434" });
    const response = await client.runGenerate({
      model: "llama3.1",
      stream: true
    });

    expect(response).toMatchObject({
      response: "Hello world",
      total_duration: 123,
      load_duration: 45,
      prompt_eval_count: 2,
      prompt_eval_duration: 6,
      eval_count: 3,
      eval_duration: 9
    });
  });

  it("rejects streamed generate responses when every non-empty line is malformed", async () => {
    const { createOllamaClient } = await vi.importActual<typeof import("../src/ollama/client.js")>(
      "../src/ollama/client.js"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn(),
        text: vi.fn().mockResolvedValue(["bad-json", "{ still bad }"].join("\n"))
      })
    );

    const client = createOllamaClient({ baseUrl: "http://127.0.0.1:11434" });

    await expect(
      client.runGenerate({
        model: "llama3.1",
        stream: true
      })
    ).rejects.toThrow("Unable to parse streamed generate response");
  });

  it("wires abort requests through the active abort controller", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;

    let capturedSignal: AbortSignal | undefined;
    runGenerate.mockImplementationOnce((_payload, options) => {
      capturedSignal = options?.signal;

      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const runPromise = request(app)
      .post(`/backend/sessions/${createdBody.id}/run`)
      .send({
        prompt: "Build a prompt",
        endpoint: "/api/generate",
        model: "llama3.1:8b",
        stream: true,
        request_id: "request-123",
        request_options: {
          num_predict: 32,
          temperature: 0.5
        }
      })
      .then((response) => response);

    for (let attempt = 0; attempt < 20 && runGenerate.mock.calls.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(runGenerate).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    const abortResponse = await request(app).post("/backend/requests/request-123/abort").send({});

    expect(abortResponse.status).toBe(202);
    expect(abortResponse.body).toEqual({ status: "accepted" });
    expect(capturedSignal?.aborted).toBe(true);

    const runResponse = await runPromise;

    expect(runResponse.status).toBe(500);
    expect(runResponse.body).toEqual({ error: "The operation was aborted" });
  });

  it("rejects duplicate active request ids without overwriting the running controller", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const firstSessionResponse = await request(app).post("/backend/sessions").send({});
    const secondSessionResponse = await request(app).post("/backend/sessions").send({});
    const firstSessionId = (firstSessionResponse.body as SessionResponseBody).id;
    const secondSessionId = (secondSessionResponse.body as SessionResponseBody).id;

    let firstCapturedSignal: AbortSignal | undefined;
    runGenerate.mockImplementationOnce((_payload, options) => {
      firstCapturedSignal = options?.signal;

      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    const firstRunPromise = request(app)
      .post(`/backend/sessions/${firstSessionId}/run`)
      .send({
        prompt: "Build a prompt",
        endpoint: "/api/generate",
        model: "llama3.1:8b",
        stream: true,
        request_id: "request-123",
        request_options: {
          num_predict: 32,
          temperature: 0.5
        }
      })
      .then((response) => response);

    for (let attempt = 0; attempt < 20 && runGenerate.mock.calls.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(runGenerate).toHaveBeenCalledTimes(1);
    expect(firstCapturedSignal?.aborted).toBe(false);

    const duplicateRunResponse = await request(app)
      .post(`/backend/sessions/${secondSessionId}/run`)
      .send({
        prompt: "Build another prompt",
        endpoint: "/api/generate",
        model: "llama3.1:8b",
        stream: true,
        request_id: "request-123",
        request_options: {
          num_predict: 32,
          temperature: 0.5
        }
      });

    expect(duplicateRunResponse.status).toBe(409);
    expect(duplicateRunResponse.body).toEqual({ error: "Request id already active" });

    const abortResponse = await request(app).post("/backend/requests/request-123/abort").send({});

    expect(abortResponse.status).toBe(202);
    expect(abortResponse.body).toEqual({ status: "accepted" });
    expect(firstCapturedSignal?.aborted).toBe(true);

    const firstRunResponse = await firstRunPromise;

    expect(firstRunResponse.status).toBe(500);
    expect(firstRunResponse.body).toEqual({ error: "The operation was aborted" });
    expect(runGenerate).toHaveBeenCalledTimes(1);
  });

  it("cleans up active request ids when session lookup fails before Ollama runs", async () => {
    const sessionId = "2026-04-22T19-29-56-00000000-0000-0000-0000-000000000001";
    const getSession = vi.fn(async () => {
      throw new Error("Session store unavailable");
    });
    const saveSession = vi.fn();
    const runService = createRunService({
      getSession,
      saveSession,
      runChat,
      runGenerate
    });

    await expect(
      runService.runSession(sessionId, {
        prompt: "Say hello",
        endpoint: "/api/chat",
        model: "llama3.1",
        stream: false,
        request_id: "request-123",
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      })
    ).rejects.toThrow("Session store unavailable");

    expect(runService.abortRequest("request-123")).toBe(false);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("keeps a stored generate endpoint when a chat run is forced", async () => {
    testRootDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    testDir = join(testRootDir, "sessions");
    await mkdir(testDir);

    const app = createApp({ sessionsDir: testDir, ollamaBaseUrl: "http://127.0.0.1:11434" });
    const createdResponse = await request(app).post("/backend/sessions").send({});
    const createdBody = createdResponse.body as SessionResponseBody;
    const sessionFile = join(testDir, `${createdBody.id}.json`);

    await writeFile(
      sessionFile,
      JSON.stringify(
        {
          ...JSON.parse(await readFile(sessionFile, "utf8")),
          endpoint: "/api/generate"
        },
        null,
        2
      ),
      "utf8"
    );

    runChat.mockResolvedValueOnce({
      message: { role: "assistant", content: "Forced chat response" },
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 1,
      prompt_eval_duration: 10,
      eval_count: 1,
      eval_duration: 10
    });

    const response = await request(app)
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

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      session: {
        id: createdBody.id,
        endpoint: "/api/generate",
        last_request: {
          model: "llama3.1",
          stream: false
        }
      }
    });
    expect(JSON.parse(await readFile(sessionFile, "utf8"))).toMatchObject({
      endpoint: "/api/generate",
      last_request: {
        model: "llama3.1",
        stream: false
      }
    });
  });

  it("preserves both message pairs across overlapping runs for the same session", async () => {
    const sessionId = "2026-04-22T19-29-56-00000000-0000-0000-0000-000000000000";
    const initialSession: StoredSession = {
      id: sessionId,
      created_at: "2026-04-22T19:29:56.000Z",
      updated_at: "2026-04-22T19:29:56.000Z",
      endpoint: "/api/chat",
      model: "llama3.1",
      stream: false,
      request_options: {
        num_predict: 32,
        temperature: 0.2
      },
      messages: [],
      last_request: {},
      last_response: {},
      last_stats: {},
      derived_metrics: {
        total_sec: null,
        load_sec: null,
        prompt_tokens_per_sec: null,
        eval_tokens_per_sec: null
      },
      runtime: {
        last_request_id: null,
        last_status: "idle"
      }
    };

    let storedSession = initialSession;
    const getSession = vi.fn(async () => storedSession);
    const createDeferred = () => {
      let resolve!: () => void;
      const promise = new Promise<void>((innerResolve) => {
        resolve = innerResolve;
      });
      return { promise, resolve };
    };
    const firstSave = createDeferred();
    const secondSave = createDeferred();
    let saveCallCount = 0;
    const saveSession = vi.fn(async (session: StoredSession) => {
      saveCallCount += 1;
      if (saveCallCount === 1) {
        await firstSave.promise;
      } else if (saveCallCount === 2) {
        await secondSave.promise;
      } else {
        throw new Error("Unexpected save call");
      }

      storedSession = session;
      return session;
    });

    let resolveFirstRun: ((value: unknown) => void) | undefined;
    let resolveSecondRun: ((value: unknown) => void) | undefined;

    runChat
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRun = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondRun = resolve;
          })
      );

    const runService = createRunService({
      getSession,
      saveSession,
      runChat,
      runGenerate
    });

    const firstRun = runService.runSession(sessionId, {
      prompt: "First prompt",
      endpoint: "/api/chat",
      model: "llama3.1",
      stream: false,
      request_options: {
        num_predict: 32,
        temperature: 0.2
      }
    });

    const secondRun = runService.runSession(sessionId, {
      prompt: "Second prompt",
      endpoint: "/api/chat",
      model: "llama3.1",
      stream: false,
      request_options: {
        num_predict: 32,
        temperature: 0.2
      }
    });

    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    await flush();

    expect(runChat).toHaveBeenCalledTimes(1);
    expect(resolveFirstRun).toBeDefined();
    expect(resolveSecondRun).toBeUndefined();
    expect(saveSession).not.toHaveBeenCalled();

    resolveFirstRun?.({
      message: { role: "assistant", content: "First reply" },
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 1,
      prompt_eval_duration: 10,
      eval_count: 1,
      eval_duration: 10
    });
    await flush();

    expect(runChat).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledTimes(1);

    firstSave.resolve();
    const firstResponse = await firstRun;

    await flush();

    expect(runChat).toHaveBeenCalledTimes(2);
    expect(resolveSecondRun).toBeDefined();
    expect(saveSession).toHaveBeenCalledTimes(1);

    resolveSecondRun?.({
      message: { role: "assistant", content: "Second reply" },
      total_duration: 2000,
      load_duration: 200,
      prompt_eval_count: 2,
      prompt_eval_duration: 20,
      eval_count: 2,
      eval_duration: 20
    });
    await flush();

    expect(saveSession).toHaveBeenCalledTimes(2);

    secondSave.resolve();
    const secondResponse = await secondRun;

    expect(firstResponse).toMatchObject({
      id: sessionId,
      messages: [
        {
          role: "user",
          content: "First prompt"
        },
        {
          role: "assistant",
          content: "First reply"
        }
      ]
    });
    expect(secondResponse).toMatchObject({
      id: sessionId,
      messages: [
        {
          role: "user",
          content: "First prompt"
        },
        {
          role: "assistant",
          content: "First reply"
        },
        {
          role: "user",
          content: "Second prompt"
        },
        {
          role: "assistant",
          content: "Second reply"
        }
      ]
    });
    expect(storedSession.messages).toEqual([
      {
        role: "user",
        content: "First prompt"
      },
      {
        role: "assistant",
        content: "First reply"
      },
      {
        role: "user",
        content: "Second prompt"
      },
      {
        role: "assistant",
        content: "Second reply"
      }
    ]);
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
        endpoint: "/api/invalid",
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
      },
      {
        prompt: "Say hello",
        endpoint: "/api/generate",
        model: "llama3.1",
        stream: "true",
        request_options: {
          num_predict: 32,
          temperature: 0.2
        }
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app).post(`/backend/sessions/${createdBody.id}/run`).send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid run request" });
    }

    expect(runChat).not.toHaveBeenCalled();
    expect(runGenerate).not.toHaveBeenCalled();
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
