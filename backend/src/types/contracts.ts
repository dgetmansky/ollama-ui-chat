import type { StoredSession } from "./session.js";

export type ModelsResponse = {
  models: Array<{ name: string }>;
};

export type SessionsResponse = {
  sessions: StoredSession[];
};
