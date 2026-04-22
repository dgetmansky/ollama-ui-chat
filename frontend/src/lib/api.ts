import type { SessionRecord } from "./types";

export const api = {
  async listModels() {
    const response = await fetch("/backend/ollama/models");
    return response.json() as Promise<{ models: Array<{ name: string }> }>;
  },

  async listSessions() {
    const response = await fetch("/backend/sessions");
    return response.json() as Promise<{ sessions: SessionRecord[] }>;
  },

  async createSession() {
    const response = await fetch("/backend/sessions", { method: "POST" });
    return response.json() as Promise<SessionRecord>;
  }
};
