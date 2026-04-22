import type { StoredSession } from "./session.js";

export type ModelsResponse = {
  models: Array<{ name: string }>;
};

export type SessionsResponse = {
  sessions: StoredSession[];
};

export type RunSessionRequest = {
  prompt: string;
  endpoint: StoredSession["endpoint"];
  model: string;
  stream: boolean;
  request_options: StoredSession["request_options"];
  request_id?: string;
};

export type RunSessionResponse = {
  session: StoredSession;
};

export type AbortRequestResponse = {
  status: "accepted";
};
