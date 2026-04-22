import { Router } from "express";
import type { AbortRequestResponse } from "../types/contracts.js";

export const createRequestsRouter = () => {
  const router = Router();

  router.post("/requests/:requestId/abort", (_request, response) => {
    const body: AbortRequestResponse = { status: "accepted" };
    response.status(202).json(body);
  });

  return router;
};
