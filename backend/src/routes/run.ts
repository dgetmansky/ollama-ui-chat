import { Router } from "express";
import type { RunSessionRequest, RunSessionResponse } from "../types/contracts.js";
import { InvalidSessionIdError, SessionNotFoundError } from "../services/sessionService.js";
import { UnsupportedRunRequestError } from "../services/runService.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidRunSessionRequest = (value: unknown): value is RunSessionRequest => {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.prompt)) {
    return false;
  }

  if (value.endpoint !== "/api/chat" && value.endpoint !== "/api/generate") {
    return false;
  }

  if (!isNonEmptyString(value.model)) {
    return false;
  }

  if (value.endpoint === "/api/chat" && value.stream !== false) {
    return false;
  }

  if (!isRecord(value.request_options)) {
    return false;
  }

  if (!isFiniteNumber(value.request_options.num_predict)) {
    return false;
  }

  if (!isFiniteNumber(value.request_options.temperature)) {
    return false;
  }

  if (value.request_id !== undefined && !isNonEmptyString(value.request_id)) {
    return false;
  }

  return true;
};

export const createRunRouter = ({
  runSession
}: {
  runSession: (sessionId: string, request: RunSessionRequest) => Promise<RunSessionResponse["session"]>;
}) => {
  const router = Router();

  router.post("/sessions/:id/run", async (request, response, next) => {
    try {
      const runRequest = request.body as unknown;

      if (!isValidRunSessionRequest(runRequest)) {
        response.status(400).json({ error: "Invalid run request" });
        return;
      }

      const session = await runSession(request.params.id, runRequest);
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
