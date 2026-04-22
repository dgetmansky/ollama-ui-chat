import type { StoredSession } from "../types/session.js";

const formatMessage = (role: "user" | "assistant", content: string) =>
  `${role === "user" ? "User" : "Assistant"}: ${content}`;

export const buildGeneratePayload = (session: StoredSession, prompt: string) => ({
  model: session.model,
  stream: session.stream,
  prompt: [...session.messages, { role: "user" as const, content: prompt }]
    .map((message) => formatMessage(message.role, message.content))
    .concat("Assistant:")
    .join("\n\n"),
  options: session.request_options
});
