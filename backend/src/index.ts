import { createApp } from "./app.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAppConfig } from "./config/appConfig.js";
import { readPromptPreamble } from "./config/promptPreamble.js";

const port = Number(process.env.PORT ?? "4174");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sessionsDir = process.env.SESSIONS_DIR ?? resolve(repoRoot, "sessions");
const configPath = process.env.CONFIG_PATH ?? resolve(repoRoot, "config.json");
const startupConfig = await readAppConfig(configPath);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? startupConfig.ollama.base_url;

const app = createApp({
  sessionsDir,
  ollamaBaseUrl,
  getSessionDefaults: async () => (await readAppConfig(configPath)).session_defaults,
  getHistoryOptions: async () => (await readAppConfig(configPath)).history,
  getPromptPreamble: async () =>
    readPromptPreamble({
      repoRoot,
      config: await readAppConfig(configPath)
    })
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Backend listening on http://127.0.0.1:${port}`);
});
