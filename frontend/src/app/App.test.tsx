import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "./App";
import { api } from "../lib/api";
import type { SessionRecord } from "../lib/types";

const { runSession } = vi.hoisted(() => ({
  runSession: vi.fn().mockResolvedValue({
    session: {
      id: "session-alpha",
      endpoint: "/api/chat",
      model: "alpha-model",
      stream: false,
      request_options: { num_predict: 256, temperature: 0.7 },
      messages: [
        { role: "user", content: "Hello from the test" },
        { role: "assistant", content: "Synthetic response" }
      ],
      last_request: { prompt: "Hello from the test" },
      last_response: { done: true },
      last_stats: { total_duration: 1000 },
      derived_metrics: { total_sec: 0.000001 }
    }
  })
}));

let sessionLookup: Record<string, SessionRecord> = {};

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
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    ping: vi.fn(),
    runSession
  }
}));

const baseSessions: SessionRecord[] = [
  {
    id: "session-alpha",
    endpoint: "/api/chat",
    model: "alpha-model",
    stream: true,
    request_options: { num_predict: 256, temperature: 0.7 },
    messages: [{ role: "user", content: "Alpha prompt" }],
    last_request: { id: "alpha-request" },
    last_response: { id: "alpha-response" },
    last_stats: { total_duration: 100 },
    derived_metrics: { total_sec: 1 }
  },
  {
    id: "session-beta",
    endpoint: "/api/generate",
    model: "beta-model",
    stream: false,
    request_options: { num_predict: 384, temperature: 0.15 },
    messages: [{ role: "assistant", content: "Beta answer" }],
    last_request: { id: "beta-request" },
    last_response: { id: "beta-response" },
    last_stats: { total_duration: 200 },
    derived_metrics: { total_sec: 2 }
  }
];

const newSession: SessionRecord = {
  id: "session-new",
  endpoint: "/api/chat",
  model: "",
  stream: true,
  request_options: { num_predict: 256, temperature: 0.7 },
  messages: [],
  last_request: {},
  last_response: {},
  last_stats: {},
  derived_metrics: {}
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listModels).mockResolvedValue({ models: [{ name: "api-catalog-model" }] });
    vi.mocked(api.listSessions).mockResolvedValue({
      sessions: baseSessions
    });
    vi.mocked(api.getSession).mockImplementation(async (sessionId: string) => {
      const session = sessionLookup[sessionId];

      if (!session) {
        throw new Error(`Unknown session ${sessionId}`);
      }

      return session;
    });
    vi.mocked(api.createSession).mockResolvedValue(newSession);
    vi.mocked(api.deleteSession).mockResolvedValue(undefined);
    vi.mocked(api.ping).mockResolvedValue({ status: "ok" });
    sessionLookup = Object.fromEntries(baseSessions.map((session) => [session.id, session]));
  });

  it("loads models and sessions on startup", async () => {
    render(<App />);

    expect(await screen.findByDisplayValue("alpha-model")).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/chat");
    expect(await screen.findByRole("button", { name: "session-alpha" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "session-beta" })).toBeInTheDocument();
  });

  it("uses non-streaming frontend defaults when no sessions exist", async () => {
    vi.mocked(api.listModels).mockResolvedValueOnce({ models: [] });
    vi.mocked(api.listSessions).mockResolvedValueOnce({ sessions: [] });

    render(<App />);

    expect(await screen.findByDisplayValue("256")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("0.7")).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/chat");
    expect(screen.getByLabelText("Stream")).not.toBeChecked();
  });

  it("opens a selected session from the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: "session-beta" });
    await user.click(screen.getByRole("button", { name: "session-beta" }));

    expect(await screen.findByDisplayValue("beta-model")).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/generate");
    expect(await screen.findByText("Beta answer")).toBeInTheDocument();
  });

  it("refreshes models, pings the backend, creates a session, and deletes the active session", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: "session-alpha" });

    await user.click(screen.getByRole("button", { name: "Refresh models" }));
    await user.click(screen.getByRole("button", { name: "Ping" }));
    await user.click(screen.getByRole("button", { name: "New session" }));
    await user.click(screen.getByRole("button", { name: "Delete session" }));

    expect(api.listModels).toHaveBeenCalledTimes(2);
    expect(api.ping).toHaveBeenCalledTimes(1);
    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(api.deleteSession).toHaveBeenCalledTimes(1);
    expect(api.deleteSession).toHaveBeenCalledWith("session-new");
  });

  it("sends a prompt and renders the assistant reply", async () => {
    const user = userEvent.setup();
    render(<App />);

    const prompt = await screen.findByLabelText("Prompt");
    await user.type(prompt, "Hello from the test");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(runSession).toHaveBeenCalledTimes(1);
    expect(runSession).toHaveBeenCalledWith("session-alpha", {
      prompt: "Hello from the test",
      endpoint: "/api/chat",
      model: "alpha-model",
      stream: false,
      request_options: { num_predict: 256, temperature: 0.7 }
    });
    expect(await screen.findByText("Synthetic response")).toBeInTheDocument();
  });

  it("forces chat requests to use the Task 8 endpoint contract", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: "session-beta" });
    await user.click(screen.getByRole("button", { name: "session-beta" }));

    const prompt = await screen.findByLabelText("Prompt");
    await user.type(prompt, "Hello from the test");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(runSession).toHaveBeenCalledWith("session-beta", {
      prompt: "Hello from the test",
      endpoint: "/api/chat",
      model: "beta-model",
      stream: false,
      request_options: { num_predict: 384, temperature: 0.15 }
    });
  });

  it("keeps the user on the currently selected session after a late send completion", async () => {
    const user = userEvent.setup();
    let resolveRunSession: ((value: { session: SessionRecord }) => void) | undefined;

    vi.mocked(api.runSession).mockImplementationOnce(
      () =>
        new Promise<{ session: SessionRecord }>((resolve) => {
          resolveRunSession = resolve;
        })
    );

    render(<App />);

    const prompt = await screen.findByLabelText("Prompt");
    await user.type(prompt, "Hello from the test");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await user.click(screen.getByRole("button", { name: "session-beta" }));
    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/generate");

    resolveRunSession?.({
      session: {
        ...baseSessions[0],
        id: "session-alpha-updated",
        messages: [
          { role: "user", content: "Hello from the test" },
          { role: "assistant", content: "Late response" }
        ],
        last_request: { prompt: "Hello from the test" },
        last_response: { done: true },
        last_stats: { total_duration: 300 },
        derived_metrics: { total_sec: 3 }
      }
    });
    sessionLookup["session-alpha-updated"] = {
      ...baseSessions[0],
      id: "session-alpha-updated",
      messages: [
        { role: "user", content: "Hello from the test" },
        { role: "assistant", content: "Late response" }
      ],
      last_request: { prompt: "Hello from the test" },
      last_response: { done: true },
      last_stats: { total_duration: 300 },
      derived_metrics: { total_sec: 3 }
    };

    expect(screen.getByLabelText("Endpoint")).toHaveValue("/api/generate");
    expect(await screen.findByRole("button", { name: "session-alpha-updated" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "session-alpha-updated" }));
    expect(await screen.findByText("Late response")).toBeInTheDocument();
  });
});
