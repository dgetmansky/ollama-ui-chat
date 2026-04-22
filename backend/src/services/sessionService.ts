import { createSessionStore } from "../storage/sessionStore.js";
import { deleteSessionFile, readSessionFile } from "../storage/sessionFiles.js";
import type { StoredSession } from "../types/session.js";

export const createSessionService = ({ sessionsDir }: { sessionsDir: string }) => {
  const store = createSessionStore({ sessionsDir });

  return {
    listSessions: () => store.list(),
    createSession: () => store.create(),
    getSession: async (sessionId: string) =>
      JSON.parse(await readSessionFile(sessionsDir, sessionId)) as StoredSession,
    deleteSession: (sessionId: string) => deleteSessionFile(sessionsDir, sessionId)
  };
};
