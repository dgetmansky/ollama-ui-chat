import { randomUUID } from "node:crypto";
import { deriveMetrics } from "../metrics/derivedMetrics.js";
import { buildChatPayload } from "../ollama/buildChatPayload.js";
import type { RunSessionRequest } from "../types/contracts.js";
import type { DerivedMetrics, StoredSession } from "../types/session.js";

type ChatStats = {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

type OllamaChatResponse = ChatStats & {
  message?: {
    role?: string;
    content?: string;
  };
};

export class UnsupportedRunRequestError extends Error {
  constructor() {
    super("Unsupported run request");
    this.name = "UnsupportedRunRequestError";
  }
}

const extractStats = (response: ChatStats): Record<string, unknown> => ({
  total_duration: response.total_duration,
  load_duration: response.load_duration,
  prompt_eval_count: response.prompt_eval_count,
  prompt_eval_duration: response.prompt_eval_duration,
  eval_count: response.eval_count,
  eval_duration: response.eval_duration
});

const mergeSession = (session: StoredSession, request: RunSessionRequest): StoredSession => ({
  ...session,
  endpoint: request.endpoint,
  model: request.model,
  stream: request.stream,
  request_options: request.request_options
});

const createFailureResponse = (error: unknown) => ({
  error: {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : "Unknown error"
  }
});

export const createRunService = ({
  getSession,
  saveSession,
  runChat
}: {
  getSession: (sessionId: string) => Promise<StoredSession>;
  saveSession: (session: StoredSession) => Promise<StoredSession>;
  runChat: (payload: unknown) => Promise<OllamaChatResponse>;
}) => ({
  async runSession(sessionId: string, request: RunSessionRequest) {
    if (request.endpoint !== "/api/chat" || request.stream) {
      throw new UnsupportedRunRequestError();
    }

    const session = mergeSession(await getSession(sessionId), request);
    const payload = buildChatPayload(session, request.prompt);
    const lastRequestId = randomUUID();
    try {
      const response = await runChat(payload);
      const stats = extractStats(response);
      const derivedMetrics: DerivedMetrics = deriveMetrics(stats);
      const assistantMessage = response.message?.content ?? "";
      const updatedSession: StoredSession = {
        ...session,
        messages: [
          ...session.messages,
          { role: "user", content: request.prompt },
          { role: "assistant", content: assistantMessage }
        ],
        last_request: payload,
        last_response: response,
        last_stats: stats,
        derived_metrics: derivedMetrics,
        runtime: {
          ...session.runtime,
          last_request_id: lastRequestId,
          last_status: "completed"
        },
        updated_at: new Date().toISOString()
      };

      return saveSession(updatedSession);
    } catch (error) {
      const failedSession: StoredSession = {
        ...session,
        last_request: payload,
        last_response: createFailureResponse(error),
        last_stats: {},
        derived_metrics: deriveMetrics({}),
        runtime: {
          ...session.runtime,
          last_request_id: lastRequestId,
          last_status: "failed"
        },
        updated_at: new Date().toISOString()
      };

      await saveSession(failedSession);
      throw error;
    }
  }
});
