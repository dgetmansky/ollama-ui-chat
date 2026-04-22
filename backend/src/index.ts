import { createApp } from "./app.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? "4174");
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sessionsDir = process.env.SESSIONS_DIR ?? resolve(repoRoot, "sessions");

const app = createApp({ sessionsDir, ollamaBaseUrl });

app.listen(port, "127.0.0.1", () => {
  console.log(`Backend listening on http://127.0.0.1:${port}`);
});
