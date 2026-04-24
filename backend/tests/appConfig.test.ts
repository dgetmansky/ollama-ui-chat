import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { readAppConfig } from "../src/config/appConfig.js";

let testDir = "";

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = "";
  }
});

describe("appConfig", () => {
  it("reads session defaults from json", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));
    const configPath = join(testDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
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
      }),
      "utf8"
    );

    await expect(readAppConfig(configPath)).resolves.toMatchObject({
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
    });
  });

  it("falls back to built-in defaults when config is missing", async () => {
    testDir = await mkdtemp(join(tmpdir(), "ollama-ui-gdp-"));

    await expect(readAppConfig(join(testDir, "missing.json"))).resolves.toMatchObject({
      session_defaults: {
        endpoint: "/api/chat",
        stream: false,
        think: true,
        request_options: {
          num_ctx: 32768,
          num_predict: 4096,
          temperature: 0.7
        }
      }
    });
  });
});
