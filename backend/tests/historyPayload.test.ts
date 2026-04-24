import { describe, expect, it } from "vitest";
import { buildChatPayload } from "../src/ollama/buildChatPayload.js";
import { buildGeneratePayload } from "../src/ollama/buildGeneratePayload.js";
import type { StoredSession } from "../src/types/session.js";

const createSession = (): StoredSession => ({
  id: "session-id",
  created_at: "2026-04-24T00:00:00.000Z",
  updated_at: "2026-04-24T00:00:00.000Z",
  endpoint: "/api/chat",
  model: "qwen3.5:9b",
  stream: false,
  think: true,
  request_options: {
    num_ctx: 32768,
    num_predict: 4096,
    temperature: 0.7
  },
  history: {
    max_messages: 2,
    include_thinking: false
  },
  messages: [
    { role: "user", content: "Old question" },
    { role: "assistant", content: "Old answer", thinking: "Old reasoning" },
    { role: "user", content: "Recent question" },
    { role: "assistant", content: "Recent answer", thinking: "Recent reasoning" }
  ],
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
});

describe("history payload", () => {
  it("limits chat history and strips thinking by default", () => {
    const payload = buildChatPayload(createSession(), "Current question");

    expect(payload.messages).toEqual([
      { role: "user", content: "Recent question" },
      { role: "assistant", content: "Recent answer" },
      { role: "user", content: "Current question" }
    ]);
  });

  it("prepends prompt preamble as a system message for chat", () => {
    const payload = buildChatPayload(createSession(), "Current question", "Base instructions");

    expect(payload.messages[0]).toEqual({
      role: "system",
      content: "Base instructions"
    });
  });

  it("includes thinking only when configured", () => {
    const session = createSession();
    session.history.include_thinking = true;

    const payload = buildChatPayload(session, "Current question");

    expect(payload.messages).toContainEqual({
      role: "assistant",
      content: "Recent answer",
      thinking: "Recent reasoning"
    });
  });

  it("limits generate history before formatting the prompt", () => {
    const payload = buildGeneratePayload(createSession(), "Current question");

    expect(payload.prompt).toBe(
      "User: Recent question\n\nAssistant: Recent answer\n\nUser: Current question\n\nAssistant:"
    );
    expect(payload.prompt).not.toContain("Old question");
    expect(payload.prompt).not.toContain("Recent reasoning");
  });

  it("prepends prompt preamble for generate", () => {
    const payload = buildGeneratePayload(createSession(), "Current question", "Base instructions");

    expect(payload.prompt.startsWith("System:\nBase instructions\n\n")).toBe(true);
  });
});
