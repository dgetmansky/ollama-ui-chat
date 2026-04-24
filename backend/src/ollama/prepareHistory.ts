import type { HistoryOptions, SessionMessage } from "../types/session.js";

const defaultHistory: HistoryOptions = {
  max_messages: 20,
  include_thinking: false
};

const normalizeHistory = (history?: HistoryOptions): HistoryOptions => ({
  max_messages:
    typeof history?.max_messages === "number" && Number.isFinite(history.max_messages)
      ? Math.max(0, Math.floor(history.max_messages))
      : defaultHistory.max_messages,
  include_thinking: history?.include_thinking ?? defaultHistory.include_thinking
});

export const prepareHistoryMessages = (
  messages: SessionMessage[],
  history?: HistoryOptions
): SessionMessage[] => {
  const options = normalizeHistory(history);
  const limitedMessages = options.max_messages === 0 ? [] : messages.slice(-options.max_messages);

  return limitedMessages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(options.include_thinking && message.thinking ? { thinking: message.thinking } : {})
  }));
};
