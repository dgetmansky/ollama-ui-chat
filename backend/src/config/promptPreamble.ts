import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { AppConfig } from "./appConfig.js";

export const readPromptPreamble = async ({
  repoRoot,
  config
}: {
  repoRoot: string;
  config: AppConfig;
}) => {
  if (!config.prompt_preamble.enabled) {
    return "";
  }

  const preamblePath = isAbsolute(config.prompt_preamble.path)
    ? config.prompt_preamble.path
    : resolve(repoRoot, config.prompt_preamble.path);

  try {
    const text = await readFile(preamblePath, "utf8");
    return text.slice(0, config.prompt_preamble.max_bytes);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      return "";
    }

    throw error;
  }
};
