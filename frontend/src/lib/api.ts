import type { SessionRecord } from "./types";

type RunSessionBody = {
  prompt: string;
  endpoint: SessionRecord["endpoint"];
  model: string;
  stream: boolean;
  request_options: SessionRecord["request_options"];
};

async function parseJsonResponse<T>(response: Response, requestName: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    const suffix = body ? `: ${body}` : "";
    throw new Error(`${requestName} failed with ${response.status} ${response.statusText}${suffix}`);
  }

  return response.json() as Promise<T>;
}

async function assertOk(response: Response, requestName: string) {
  if (!response.ok) {
    const body = await response.text();
    const suffix = body ? `: ${body}` : "";
    throw new Error(`${requestName} failed with ${response.status} ${response.statusText}${suffix}`);
  }
}

export const api = {
  async listModels() {
    const response = await fetch("/backend/ollama/models");
    return parseJsonResponse<{ models: Array<{ name: string }> }>(response, "List models request");
  },

  async listSessions() {
    const response = await fetch("/backend/sessions");
    return parseJsonResponse<{ sessions: SessionRecord[] }>(response, "List sessions request");
  },

  async createSession() {
    const response = await fetch("/backend/sessions", { method: "POST" });
    return parseJsonResponse<SessionRecord>(response, "Create session request");
  },

  async runSession(sessionId: string, body: RunSessionBody) {
    const response = await fetch(`/backend/sessions/${encodeURIComponent(sessionId)}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return parseJsonResponse<{ session: SessionRecord }>(response, "Run session request");
  },

  async getSession(sessionId: string) {
    const response = await fetch(`/backend/sessions/${sessionId}`);
    return parseJsonResponse<SessionRecord>(response, "Get session request");
  },

  async deleteSession(sessionId: string) {
    const response = await fetch(`/backend/sessions/${sessionId}`, { method: "DELETE" });
    await assertOk(response, "Delete session request");
  },

  async ping() {
    const response = await fetch("/backend/ollama/ping");
    return parseJsonResponse<{ status: "ok" }>(response, "Ping request");
  }
};
