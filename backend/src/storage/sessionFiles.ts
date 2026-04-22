import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ensureSessionsDir = async (sessionsDir: string) => {
  await mkdir(sessionsDir, { recursive: true });
};

export const sessionPath = (sessionsDir: string, sessionId: string) =>
  join(sessionsDir, `${sessionId}.json`);

export const readSessionFile = async (sessionsDir: string, sessionId: string) =>
  readFile(sessionPath(sessionsDir, sessionId), "utf8");

export const writeSessionFile = async (sessionsDir: string, sessionId: string, text: string) => {
  await ensureSessionsDir(sessionsDir);
  await writeFile(sessionPath(sessionsDir, sessionId), text, "utf8");
};

export const deleteSessionFile = async (sessionsDir: string, sessionId: string) => {
  await rm(sessionPath(sessionsDir, sessionId), { force: true });
};

export const listSessionFiles = async (sessionsDir: string) => {
  await ensureSessionsDir(sessionsDir);
  return (await readdir(sessionsDir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
};
