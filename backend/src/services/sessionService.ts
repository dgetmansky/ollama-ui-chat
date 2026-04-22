import { createSessionStore } from "../storage/sessionStore.js";
import { deleteSessionFile, readSessionFile } from "../storage/sessionFiles.js";
import type { StoredSession } from "../types/session.js";

export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "SessionNotFoundError";
  }
}

export class InvalidSessionIdError extends Error {
  constructor() {
    super("Invalid session id");
    this.name = "InvalidSessionIdError";
  }
}

const sessionIdPattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const assertValidSessionId = (sessionId: string) => {
  if (!sessionIdPattern.test(sessionId)) {
    throw new InvalidSessionIdError();
  }
};

export const createSessionService = ({ sessionsDir }: { sessionsDir: string }) => {
  const store = createSessionStore({ sessionsDir });

  return {
    listSessions: () => store.list(),
    createSession: () => store.create(),
    getSession: async (sessionId: string) => {
      assertValidSessionId(sessionId);

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
    deleteSession: async (sessionId: string) => {
      assertValidSessionId(sessionId);
      await deleteSessionFile(sessionsDir, sessionId);
    }
  };
};
