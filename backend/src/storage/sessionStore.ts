import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import {
  deleteSessionFile,
  listSessionFiles,
  readSessionFile,
  sessionPath,
  writeSessionFile
} from "./sessionFiles.js";
import type { DerivedMetrics, HistoryOptions, SessionDefaults, StoredSession } from "../types/session.js";

const defaultSessionDefaults: SessionDefaults = {
  endpoint: "/api/chat",
  stream: false,
  think: true,
  request_options: {
    num_ctx: 32768,
    num_predict: 4096,
    temperature: 0.7
  }
};

const defaultHistoryOptions: HistoryOptions = {
  max_messages: 20,
  include_thinking: false
};

const createEmptyMetrics = (): DerivedMetrics => ({
  total_sec: null,
  load_sec: null,
  prompt_tokens_per_sec: null,
  eval_tokens_per_sec: null
});

const createSessionId = () => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  return `${stamp}-${randomUUID()}`;
};

const createDefaultSession = (
  defaults: SessionDefaults = defaultSessionDefaults,
  history: HistoryOptions = defaultHistoryOptions
): StoredSession => {
  const now = new Date().toISOString();
  const id = createSessionId();

  return {
    id,
    created_at: now,
    updated_at: now,
    endpoint: defaults.endpoint,
    model: "",
    stream: defaults.stream,
    think: defaults.think,
    request_options: { ...defaults.request_options },
    history: { ...history },
    messages: [],
    last_request: {},
    last_response: {},
    last_stats: {},
    derived_metrics: createEmptyMetrics(),
    runtime: {
      last_request_id: null,
      last_status: "idle"
    }
  };
};

export const createSessionStore = ({
  sessionsDir,
  getSessionDefaults = async () => defaultSessionDefaults,
  getHistoryOptions = async () => defaultHistoryOptions
}: {
  sessionsDir: string;
  getSessionDefaults?: () => Promise<SessionDefaults>;
  getHistoryOptions?: () => Promise<HistoryOptions>;
}) => ({
  async create() {
    const session = createDefaultSession(await getSessionDefaults(), await getHistoryOptions());
    await writeSessionFile(sessionsDir, session.id, JSON.stringify(session, null, 2));
    return session;
  },

  async list() {
    const files = await listSessionFiles(sessionsDir);

    const sessions = await Promise.all(
      files.map(async (name: string) => {
        const sessionId = name.replace(/\.json$/, "");
        const [text, fileStat] = await Promise.all([
          readSessionFile(sessionsDir, sessionId),
          stat(sessionPath(sessionsDir, sessionId))
        ]);

        return {
          session: JSON.parse(text) as StoredSession,
          mtimeMs: fileStat.mtimeMs
        };
      })
    );

    return sessions
      .sort(
        (
          left: { session: StoredSession; mtimeMs: number },
          right: { session: StoredSession; mtimeMs: number }
        ) =>
          right.session.created_at.localeCompare(left.session.created_at) ||
          right.mtimeMs - left.mtimeMs ||
          right.session.id.localeCompare(left.session.id)
      )
      .map(({ session }: { session: StoredSession; mtimeMs: number }) => session);
  },

  async get(sessionId: string) {
    return JSON.parse(await readSessionFile(sessionsDir, sessionId)) as StoredSession;
  },

  async save(session: StoredSession) {
    await writeSessionFile(sessionsDir, session.id, JSON.stringify(session, null, 2));
    return session;
  },

  async delete(sessionId: string) {
    await deleteSessionFile(sessionsDir, sessionId);
  }
});
