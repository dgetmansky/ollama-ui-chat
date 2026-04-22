import type { StoredSession } from "../types/session.js";

export const buildChatPayload = (session: StoredSession, prompt: string) => ({
  model: session.model,
  stream: session.stream,
  messages: [...session.messages, { role: "user" as const, content: prompt }],
  options: session.request_options
});
