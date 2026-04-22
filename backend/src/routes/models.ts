import { Router } from "express";
import type { ModelsResponse } from "../types/contracts.js";

export const createModelsRouter = ({
  listModels
}: {
  listModels: () => Promise<Array<{ name: string }>>;
}) => {
  const router = Router();

  router.get("/ollama/models", async (_request, response, next) => {
    try {
      const models: ModelsResponse = { models: await listModels() };
      response.json(models);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
