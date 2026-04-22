import { Router } from "express";
import type { RunSessionRequest, RunSessionResponse } from "../types/contracts.js";
import { InvalidSessionIdError, SessionNotFoundError } from "../services/sessionService.js";
import { UnsupportedRunRequestError } from "../services/runService.js";

export const createRunRouter = ({
  runSession
}: {
  runSession: (sessionId: string, request: RunSessionRequest) => Promise<RunSessionResponse["session"]>;
}) => {
  const router = Router();

  router.post("/sessions/:id/run", async (request, response, next) => {
    try {
      const session = await runSession(request.params.id, request.body as RunSessionRequest);
      const body: RunSessionResponse = { session };
      response.json(body);
    } catch (error) {
      if (error instanceof InvalidSessionIdError) {
        response.status(400).json({ error: "Invalid session id" });
        return;
      }

      if (error instanceof SessionNotFoundError) {
        response.status(404).json({ error: "Session not found" });
        return;
      }

      if (error instanceof UnsupportedRunRequestError) {
        response.status(400).json({ error: "Unsupported run request" });
        return;
      }

      next(error);
    }
  });

  return router;
};
