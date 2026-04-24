import type { StoredSession } from "../types/session.js";
import { prepareHistoryMessages } from "./prepareHistory.js";

const createSystemMessages = (promptPreamble?: string) =>
  promptPreamble?.trim() ? [{ role: "system" as const, content: promptPreamble }] : [];

export const buildChatPayload = (session: StoredSession, prompt: string, promptPreamble = "") => ({
  model: session.model,
  stream: session.stream,
  think: session.think,
  messages: [
    ...createSystemMessages(promptPreamble),
    ...prepareHistoryMessages(session.messages, session.history),
    { role: "user" as const, content: prompt }
  ],
  options: session.request_options
});
