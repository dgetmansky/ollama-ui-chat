import { Router } from "express";
import type { AbortRequestResponse } from "../types/contracts.js";

export const createRequestsRouter = ({
  abortRequest
}: {
  abortRequest: (requestId: string) => boolean;
}) => {
  const router = Router();

  router.post("/requests/:requestId/abort", (request, response) => {
    if (!abortRequest(request.params.requestId)) {
      response.status(404).json({ error: "Request not found" });
      return;
    }

    const body: AbortRequestResponse = { status: "accepted" };
    response.status(202).json(body);
  });

  return router;
};
