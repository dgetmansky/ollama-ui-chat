import express from "express";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createRequestsRouter } from "./routes/requests.js";
import { createRunRouter } from "./routes/run.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createRunService } from "./services/runService.js";
import { createSessionService } from "./services/sessionService.js";
import { createOllamaClient } from "./ollama/client.js";
import type { HistoryOptions, SessionDefaults } from "./types/session.js";

export const createApp = ({
  sessionsDir,
  ollamaBaseUrl,
  getSessionDefaults,
  getHistoryOptions,
  getPromptPreamble
}: {
  sessionsDir: string;
  ollamaBaseUrl: string;
  getSessionDefaults?: () => Promise<SessionDefaults>;
  getHistoryOptions?: () => Promise<HistoryOptions>;
  getPromptPreamble?: () => Promise<string>;
}) => {
  const app = express();
  const sessionService = createSessionService({ sessionsDir, getSessionDefaults, getHistoryOptions });
  const ollamaClient = createOllamaClient({ baseUrl: ollamaBaseUrl });
  const runService = createRunService({
    getSession: sessionService.getSession,
    saveSession: sessionService.saveSession,
    runChat: ollamaClient.runChat,
    runGenerate: ollamaClient.runGenerate,
    getPromptPreamble
  });

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
  app.use("/backend", createRunRouter({ runSession: runService.runSession }));
  app.use("/backend", createRequestsRouter({ abortRequest: runService.abortRequest }));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ error: error.message });
  });

  return app;
};
