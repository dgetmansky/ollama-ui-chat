import { randomUUID } from "node:crypto";
import { listSessionFiles, readSessionFile, writeSessionFile } from "./sessionFiles";
import type { DerivedMetrics, StoredSession } from "../types/session";

let sessionCreationSequence = 0;

const createEmptyMetrics = (): DerivedMetrics => ({
  total_sec: null,
  load_sec: null,
  prompt_tokens_per_sec: null,
  eval_tokens_per_sec: null
});

const createSessionId = () => {
  const stamp = new Date().toISOString().replace(/:/g, "-");
  const sequence = String(sessionCreationSequence++).padStart(6, "0");

  return `${stamp}-${sequence}-${randomUUID()}`;
};

const createDefaultSession = (): StoredSession => {
  const now = new Date().toISOString();

  return {
    id: createSessionId(),
    created_at: now,
    updated_at: now,
    endpoint: "/api/chat",
    model: "",
    stream: true,
    request_options: {
      num_predict: 256,
      temperature: 0.7
    },
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

export const createSessionStore = ({ sessionsDir }: { sessionsDir: string }) => ({
  async create() {
    const session = createDefaultSession();
    await writeSessionFile(sessionsDir, session.id, JSON.stringify(session, null, 2));
    return session;
  },

  async list() {
    const files = await listSessionFiles(sessionsDir);

    const sessions = await Promise.all(
      files.map(
        async (name) =>
          JSON.parse(await readSessionFile(sessionsDir, name.replace(/\.json$/, ""))) as StoredSession
      )
    );

    return sessions.sort(
      (left, right) =>
        right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id)
    );
  }
});
