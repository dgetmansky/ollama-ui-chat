import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";

vi.mock("../lib/api", () => ({
  api: {
    listModels: vi.fn().mockResolvedValue({ models: [{ name: "llama3.1:8b" }] }),
    listSessions: vi.fn().mockResolvedValue({
      sessions: [
        {
          id: "2026-04-22T10-15-03-550e8400",
          endpoint: "/api/chat",
          model: "llama3.1:8b",
          stream: true,
          request_options: { num_predict: 256, temperature: 0.7 },
          messages: [],
          last_request: {},
          last_response: {},
          last_stats: {},
          derived_metrics: {}
        }
      ]
    }),
    createSession: vi.fn()
  }
}));

describe("App", () => {
  it("loads models and sessions on startup", async () => {
    render(<App />);

    expect(await screen.findByDisplayValue("llama3.1:8b")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "2026-04-22T10-15-03-550e8400" })
    ).toBeInTheDocument();
  });
});
