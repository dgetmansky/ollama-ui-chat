import type { StoredSession } from "../types/session.js";
import { prepareHistoryMessages } from "./prepareHistory.js";

const formatMessage = (role: "user" | "assistant", content: string) =>
  `${role === "user" ? "User" : "Assistant"}: ${content}`;

const formatPromptPreamble = (promptPreamble: string) =>
  promptPreamble.trim() ? [`System:\n${promptPreamble.trim()}`] : [];

export const buildGeneratePayload = (session: StoredSession, prompt: string, promptPreamble = "") => ({
  model: session.model,
  stream: session.stream,
  prompt: [
    ...formatPromptPreamble(promptPreamble),
    ...[...prepareHistoryMessages(session.messages, session.history), { role: "user" as const, content: prompt }]
      .map((message) => formatMessage(message.role, message.content))
  ]
    .concat("Assistant:")
    .join("\n\n"),
  options: session.request_options
});
