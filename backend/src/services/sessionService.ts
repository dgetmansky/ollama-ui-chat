import { createSessionStore } from "../storage/sessionStore.js";
import { deleteSessionFile, readSessionFile } from "../storage/sessionFiles.js";
import type { StoredSession } from "../types/session.js";

export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "SessionNotFoundError";
  }
}

export const createSessionService = ({ sessionsDir }: { sessionsDir: string }) => {
  const store = createSessionStore({ sessionsDir });

  return {
    listSessions: () => store.list(),
    createSession: () => store.create(),
    getSession: async (sessionId: string) => {
      try {
        return JSON.parse(await readSessionFile(sessionsDir, sessionId)) as StoredSession;
      } catch (error) {
        const fileError = error as NodeJS.ErrnoException;

        if (fileError.code === "ENOENT") {
          throw new SessionNotFoundError();
        }

        throw error;
      }
    },
    deleteSession: (sessionId: string) => deleteSessionFile(sessionsDir, sessionId)
  };
};
