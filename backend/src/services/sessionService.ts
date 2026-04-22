import { createSessionStore } from "../storage/sessionStore.js";

export const createSessionService = ({ sessionsDir }: { sessionsDir: string }) => {
  const store = createSessionStore({ sessionsDir });

  return {
    listSessions: () => store.list(),
    createSession: () => store.create()
  };
};
