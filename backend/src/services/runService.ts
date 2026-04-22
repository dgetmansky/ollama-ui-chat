import { randomUUID } from "node:crypto";
import { deriveMetrics } from "../metrics/derivedMetrics.js";
import { buildChatPayload } from "../ollama/buildChatPayload.js";
import { buildGeneratePayload } from "../ollama/buildGeneratePayload.js";
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

type OllamaGenerateResponse = ChatStats & {
  response?: string;
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

const applyRunRequest = (session: StoredSession, request: RunSessionRequest): StoredSession => ({
  ...session,
  endpoint:
    session.endpoint === "/api/generate" || request.endpoint === "/api/generate"
      ? "/api/generate"
      : "/api/chat",
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
  runChat,
  runGenerate
}: {
  getSession: (sessionId: string) => Promise<StoredSession>;
  saveSession: (session: StoredSession) => Promise<StoredSession>;
  runChat: (payload: unknown) => Promise<OllamaChatResponse>;
  runGenerate: (payload: unknown) => Promise<OllamaGenerateResponse>;
}) => {
  const sessionQueues = new Map<string, Promise<unknown>>();

  const runQueuedSession = async <T>(sessionId: string, task: () => Promise<T>): Promise<T> => {
    const previousRun = sessionQueues.get(sessionId) ?? Promise.resolve();
    const currentRun = previousRun.catch(() => undefined).then(task);
    sessionQueues.set(sessionId, currentRun);

    try {
      return await currentRun;
    } finally {
      if (sessionQueues.get(sessionId) === currentRun) {
        sessionQueues.delete(sessionId);
      }
    }
  };

  return {
    async runSession(sessionId: string, request: RunSessionRequest) {
      if (request.endpoint !== "/api/chat" && request.endpoint !== "/api/generate") {
        throw new UnsupportedRunRequestError();
      }

      if (request.endpoint === "/api/chat" && request.stream) {
        throw new UnsupportedRunRequestError();
      }

      return runQueuedSession(sessionId, async () => {
        const session = applyRunRequest(await getSession(sessionId), request);
        const lastRequestId = randomUUID();
        try {
          const isGenerateRun = request.endpoint === "/api/generate";
          const payload = isGenerateRun
            ? buildGeneratePayload(session, request.prompt)
            : buildChatPayload(session, request.prompt);
          const latestSession = await getSession(sessionId);
          if (isGenerateRun) {
            const response = await runGenerate(payload);
            const stats = extractStats(response);
            const derivedMetrics: DerivedMetrics = deriveMetrics(stats);
            const updatedSession: StoredSession = {
              ...applyRunRequest(latestSession, request),
              messages: [
                ...latestSession.messages,
                { role: "user", content: request.prompt },
                { role: "assistant", content: response.response ?? "" }
              ],
              last_request: payload,
              last_response: response,
              last_stats: stats,
              derived_metrics: derivedMetrics,
              runtime: {
                ...latestSession.runtime,
                last_request_id: lastRequestId,
                last_status: "completed"
              },
              updated_at: new Date().toISOString()
            };

            return saveSession(updatedSession);
          }

          const response = await runChat(payload);
          const stats = extractStats(response);
          const derivedMetrics: DerivedMetrics = deriveMetrics(stats);
          const updatedSession: StoredSession = {
            ...applyRunRequest(latestSession, request),
            messages: [
              ...latestSession.messages,
              { role: "user", content: request.prompt },
              { role: "assistant", content: response.message?.content ?? "" }
            ],
            last_request: payload,
            last_response: response,
            last_stats: stats,
            derived_metrics: derivedMetrics,
            runtime: {
              ...latestSession.runtime,
              last_request_id: lastRequestId,
              last_status: "completed"
            },
            updated_at: new Date().toISOString()
          };

          return saveSession(updatedSession);
        } catch (error) {
          const latestSession = await getSession(sessionId);
          const isGenerateRun = request.endpoint === "/api/generate";
          const payload = isGenerateRun
            ? buildGeneratePayload(session, request.prompt)
            : buildChatPayload(session, request.prompt);
          const failedSession: StoredSession = {
            ...applyRunRequest(latestSession, request),
            messages: [
              ...latestSession.messages,
              { role: "user", content: request.prompt }
            ],
            last_request: payload,
            last_response: createFailureResponse(error),
            last_stats: {},
            derived_metrics: deriveMetrics({}),
            runtime: {
              ...latestSession.runtime,
              last_request_id: lastRequestId,
              last_status: "failed"
            },
            updated_at: new Date().toISOString()
          };

          await saveSession(failedSession);
          throw error;
        }
      });
    }
  };
};
