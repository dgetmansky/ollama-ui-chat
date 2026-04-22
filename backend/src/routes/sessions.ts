import { Router } from "express";
import type { SessionsResponse } from "../types/contracts.js";
import type { StoredSession } from "../types/session.js";

export const createSessionsRouter = ({
  listSessions,
  createSession
}: {
  listSessions: () => Promise<StoredSession[]>;
  createSession: () => Promise<StoredSession>;
}) => {
  const router = Router();

  router.get("/sessions", async (_request, response, next) => {
    try {
      const sessions: SessionsResponse = { sessions: await listSessions() };
      response.json(sessions);
    } catch (error) {
      next(error);
    }
  });

  router.post("/sessions", async (_request, response, next) => {
    try {
      const session = await createSession();
      response.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
