import { Router } from "express";
import type { SessionsResponse } from "../types/contracts.js";
import type { StoredSession } from "../types/session.js";
import { InvalidSessionIdError, SessionNotFoundError } from "../services/sessionService.js";

export const createSessionsRouter = ({
  listSessions,
  createSession,
  getSession,
  deleteSession,
  ping
}: {
  listSessions: () => Promise<StoredSession[]>;
  createSession: () => Promise<StoredSession>;
  getSession: (sessionId: string) => Promise<StoredSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  ping: () => Promise<{ status: "ok" }>;
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

  router.get("/sessions/:id", async (request, response, next) => {
    try {
      const session = await getSession(request.params.id);
      response.json(session);
    } catch (error) {
      if (error instanceof InvalidSessionIdError) {
        response.status(400).json({ error: "Invalid session id" });
        return;
      }

      if (error instanceof SessionNotFoundError) {
        response.status(404).json({ error: "Session not found" });
        return;
      }

      next(error);
    }
  });

  router.delete("/sessions/:id", async (request, response, next) => {
    try {
      await deleteSession(request.params.id);
      response.status(204).end();
    } catch (error) {
      if (error instanceof InvalidSessionIdError) {
        response.status(400).json({ error: "Invalid session id" });
        return;
      }

      next(error);
    }
  });

  router.get("/ollama/ping", async (_request, response, next) => {
    try {
      response.json(await ping());
    } catch (error) {
      next(error);
    }
  });

  return router;
};
