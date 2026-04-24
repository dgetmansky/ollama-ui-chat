import { createSessionStore } from "../storage/sessionStore.js";
import type { HistoryOptions, SessionDefaults, StoredSession } from "../types/session.js";

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

export const createSessionService = ({
  sessionsDir,
  getSessionDefaults,
  getHistoryOptions
}: {
  sessionsDir: string;
  getSessionDefaults?: () => Promise<SessionDefaults>;
  getHistoryOptions?: () => Promise<HistoryOptions>;
}) => {
  const store = createSessionStore({ sessionsDir, getSessionDefaults, getHistoryOptions });

  return {
    listSessions: () => store.list(),
    createSession: () => store.create(),
    getSession: async (sessionId: string) => {
      assertValidSessionId(sessionId);

      try {
        return await store.get(sessionId);
      } catch (error) {
        const fileError = error as NodeJS.ErrnoException;

        if (fileError.code === "ENOENT") {
          throw new SessionNotFoundError();
        }

        throw error;
      }
    },
    saveSession: async (session: StoredSession) => {
      assertValidSessionId(session.id);
      return store.save(session);
    },
    deleteSession: async (sessionId: string) => {
      assertValidSessionId(sessionId);
      await store.delete(sessionId);
    }
  };
};
