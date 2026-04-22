import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? "4174");
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const sessionsDir = process.env.SESSIONS_DIR ?? "sessions";

const app = createApp({ sessionsDir, ollamaBaseUrl });

app.listen(port, () => {
  console.log(`Backend listening on http://127.0.0.1:${port}`);
});
