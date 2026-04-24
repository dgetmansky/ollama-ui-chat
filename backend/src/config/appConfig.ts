import { readFile } from "node:fs/promises";
import type { HistoryOptions, SessionDefaults } from "../types/session.js";

export type AppConfig = {
  session_defaults: SessionDefaults;
  ollama: {
    base_url: string;
  };
  history: HistoryOptions;
  prompt_preamble: {
    enabled: boolean;
    path: string;
    max_bytes: number;
  };
};

export const defaultAppConfig: AppConfig = {
  session_defaults: {
    endpoint: "/api/chat",
    stream: false,
    think: true,
    request_options: {
      num_ctx: 32768,
      num_predict: 4096,
      temperature: 0.7
    }
  },
  ollama: {
    base_url: "http://127.0.0.1:11434"
  },
  history: {
    max_messages: 20,
    include_thinking: false
  },
  prompt_preamble: {
    enabled: true,
    path: "AGENTS.md",
    max_bytes: 65536
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const readString = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const readEndpoint = (value: unknown, fallback: SessionDefaults["endpoint"]) =>
  value === "/api/chat" || value === "/api/generate" ? value : fallback;

const normalizeAppConfig = (value: unknown): AppConfig => {
  const root = isRecord(value) ? value : {};
  const rawDefaults = isRecord(root.session_defaults) ? root.session_defaults : {};
  const rawOptions = isRecord(rawDefaults.request_options) ? rawDefaults.request_options : {};
  const rawOllama = isRecord(root.ollama) ? root.ollama : {};
  const rawHistory = isRecord(root.history) ? root.history : {};
  const rawPreamble = isRecord(root.prompt_preamble) ? root.prompt_preamble : {};
  const fallback = defaultAppConfig;

  return {
    session_defaults: {
      endpoint: readEndpoint(rawDefaults.endpoint, fallback.session_defaults.endpoint),
      stream: readBoolean(rawDefaults.stream, fallback.session_defaults.stream),
      think: readBoolean(rawDefaults.think, fallback.session_defaults.think),
      request_options: {
        num_ctx: readNumber(rawOptions.num_ctx, fallback.session_defaults.request_options.num_ctx ?? 32768),
        num_predict: readNumber(rawOptions.num_predict, fallback.session_defaults.request_options.num_predict),
        temperature: readNumber(rawOptions.temperature, fallback.session_defaults.request_options.temperature)
      }
    },
    ollama: {
      base_url: readString(rawOllama.base_url, fallback.ollama.base_url)
    },
    history: {
      max_messages: readNumber(rawHistory.max_messages, fallback.history.max_messages),
      include_thinking: readBoolean(rawHistory.include_thinking, fallback.history.include_thinking)
    },
    prompt_preamble: {
      enabled: readBoolean(rawPreamble.enabled, fallback.prompt_preamble.enabled),
      path: readString(rawPreamble.path, fallback.prompt_preamble.path),
      max_bytes: readNumber(rawPreamble.max_bytes, fallback.prompt_preamble.max_bytes)
    }
  };
};

export const readAppConfig = async (configPath: string): Promise<AppConfig> => {
  try {
    return normalizeAppConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === "ENOENT") {
      return defaultAppConfig;
    }

    throw error;
  }
};
