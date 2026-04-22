import express from "express";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createSessionService } from "./services/sessionService.js";
import { createOllamaClient } from "./ollama/client.js";

export const createApp = ({
  sessionsDir,
  ollamaBaseUrl
}: {
  sessionsDir: string;
  ollamaBaseUrl: string;
}) => {
  const app = express();
  const sessionService = createSessionService({ sessionsDir });
  const ollamaClient = createOllamaClient({ baseUrl: ollamaBaseUrl });

  app.use(express.json());
  app.use("/backend", createHealthRouter());
  app.use("/backend", createModelsRouter({ listModels: ollamaClient.listModels }));
  app.use(
    "/backend",
    createSessionsRouter({
      listSessions: sessionService.listSessions,
      createSession: sessionService.createSession,
      getSession: sessionService.getSession,
      deleteSession: sessionService.deleteSession,
      ping: ollamaClient.ping
    })
  );

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: error.message });
  });

  return app;
};
