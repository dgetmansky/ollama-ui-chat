import { useEffect, useState } from "react";
import { ChatPanel } from "../features/chat/ChatPanel";
import { ControlBar } from "../features/control-bar/ControlBar";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { SessionsPanel } from "../features/sessions/SessionsPanel";
import { api } from "../lib/api";
import type { SessionRecord } from "../lib/types";

const emptySession: SessionRecord = {
  id: "",
  endpoint: "/api/chat",
  model: "",
  stream: false,
  request_options: {
    num_predict: 0,
    temperature: 0
  },
  messages: [],
  last_request: {},
  last_response: {},
  last_stats: {},
  derived_metrics: {}
};

export const App = () => {
  const [models, setModels] = useState<Array<{ name: string }>>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [modelsResponse, sessionsResponse] = await Promise.all([
          api.listModels(),
          api.listSessions()
        ]);

        if (cancelled) {
          return;
        }

        setModels(modelsResponse.models);
        setSessions(sessionsResponse.sessions);
        setActiveSessionId(
          (currentSessionId) => currentSessionId || sessionsResponse.sessions[0]?.id || ""
        );
        setStartupError("");
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : "Startup failed");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? emptySession;
  const model = activeSession.model || models[0]?.name || "";

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ollama UI GDP</h1>
        <span className="status-pill">{startupError ? "Startup failed" : "Backend reachable"}</span>
      </header>
      <ControlBar
        endpoint={activeSession.endpoint}
        model={model}
        stream={activeSession.stream}
        numPredict={activeSession.request_options.num_predict}
        temperature={activeSession.request_options.temperature}
      />
      <div className="content-grid">
        <SessionsPanel sessionIds={sessions.map((session) => session.id)} />
        <ChatPanel messages={activeSession.messages} />
        <DiagnosticsPanel
          requestPayload={activeSession.last_request}
          responsePayload={activeSession.last_response}
          stats={activeSession.last_stats}
          metrics={activeSession.derived_metrics}
        />
      </div>
    </div>
  );
};
