import express from "express";

const app = express();
const port = 4174;

app.get("/backend/health", (_request, response) => {
  response.json({ ok: true });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Backend listening on http://127.0.0.1:${port}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
