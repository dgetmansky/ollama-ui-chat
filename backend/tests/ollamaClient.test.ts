import { describe, expect, it, vi } from "vitest";
import { createOllamaClient } from "../src/ollama/client.js";

describe("ollama client", () => {
  it("returns ping latency in milliseconds", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(142.4);

    const client = createOllamaClient({ baseUrl: "http://127.0.0.1:11434" });

    await expect(client.ping()).resolves.toEqual({ status: "ok", latency_ms: 42 });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/tags");
  });
});
