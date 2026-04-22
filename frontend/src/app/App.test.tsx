import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    listModels: vi.fn().mockResolvedValue({ models: [{ name: "api-catalog-model" }] }),
    listSessions: vi.fn().mockResolvedValue({
      sessions: [
        {
          id: "session-from-api-9f2a",
          endpoint: "/api/generate",
          model: "preferred-session-model",
          stream: false,
          request_options: { num_predict: 384, temperature: 0.15 },
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

    expect(await screen.findByDisplayValue("preferred-session-model")).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/generate");
    expect(await screen.findByRole("button", { name: "session-from-api-9f2a" })).toBeInTheDocument();
  });

  it("uses the backend default session contract when no sessions exist", async () => {
    vi.mocked(api.listModels).mockResolvedValueOnce({ models: [] });
    vi.mocked(api.listSessions).mockResolvedValueOnce({ sessions: [] });

    render(<App />);

    expect(await screen.findByDisplayValue("256")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("0.7")).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/chat");
    expect(screen.getByLabelText("Stream")).toBeChecked();
  });
});
