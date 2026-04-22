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
    num_predict: 256,
    temperature: 0.7
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
  const [actionStatus, setActionStatus] = useState("Idle");

  const describeError = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

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
        setActionStatus("Idle");
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

  const refreshModels = async () => {
    try {
      const modelsResponse = await api.listModels();
      setModels(modelsResponse.models);
      setActionStatus("Models refreshed");
    } catch (error) {
      setActionStatus(describeError(error, "Model refresh failed"));
    }
  };

  const pingBackend = async () => {
    try {
      await api.ping();
      setActionStatus("Ping successful");
    } catch (error) {
      setActionStatus(describeError(error, "Ping failed"));
    }
  };

  const openSession = async (sessionId: string) => {
    try {
      const session = await api.getSession(sessionId);
      setSessions((currentSessions) => {
        const nextSessions = currentSessions.map((currentSession) =>
          currentSession.id === session.id ? session : currentSession
        );

        if (currentSessions.every((currentSession) => currentSession.id !== session.id)) {
          nextSessions.unshift(session);
        }

        return nextSessions;
      });
      setActiveSessionId(session.id);
      setActionStatus("Session opened");
    } catch (error) {
      setActionStatus(describeError(error, "Open session failed"));
    }
  };

  const createNewSession = async () => {
    try {
      const session = await api.createSession();
      setSessions((currentSessions) => [session, ...currentSessions]);
      setActiveSessionId(session.id);
      setActionStatus("Session created");
    } catch (error) {
      setActionStatus(describeError(error, "Create session failed"));
    }
  };

  const deleteActiveSession = async () => {
    if (!activeSessionId) {
      return;
    }

    try {
      await api.deleteSession(activeSessionId);
      setSessions((currentSessions) => {
        const nextSessions = currentSessions.filter((session) => session.id !== activeSessionId);

        setActiveSessionId((currentActiveSessionId) =>
          currentActiveSessionId === activeSessionId ? nextSessions[0]?.id ?? "" : currentActiveSessionId
        );

        return nextSessions;
      });
      setActionStatus("Session deleted");
    } catch (error) {
      setActionStatus(describeError(error, "Delete session failed"));
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const sessionView = activeSession ?? sessions[0] ?? emptySession;
  const model = sessionView.model || models[0]?.name || "";

  const handleSend = async (prompt: string) => {
    if (!activeSession) {
      return;
    }

    const response = await api.runSession(activeSession.id, {
      prompt,
      endpoint: activeSession.endpoint,
      model: activeSession.model || models[0]?.name || "",
      stream: false,
      request_options: activeSession.request_options
    });

    setSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === response.session.id ? response.session : session))
    );
    setActiveSessionId(response.session.id);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ollama UI GDP</h1>
        <span className="status-pill">{startupError ? "Startup failed" : "Backend reachable"}</span>
        <span className="status-pill">{actionStatus ? `Action: ${actionStatus}` : "Action: Idle"}</span>
      </header>
      <ControlBar
        endpoint={sessionView.endpoint}
        model={model}
        stream={sessionView.stream}
        numPredict={sessionView.request_options.num_predict}
        temperature={sessionView.request_options.temperature}
        onRefreshModels={refreshModels}
        onPingBackend={pingBackend}
        onCreateNewSession={createNewSession}
      />
      <div className="content-grid">
        <SessionsPanel
          sessionIds={sessions.map((session) => session.id)}
          activeSessionId={activeSessionId}
          onSelectSession={openSession}
          onDeleteActiveSession={deleteActiveSession}
        />
        <ChatPanel messages={sessionView.messages} onSend={handleSend} />
        <DiagnosticsPanel
          requestPayload={sessionView.last_request}
          responsePayload={sessionView.last_response}
          stats={sessionView.last_stats}
          metrics={sessionView.derived_metrics}
        />
      </div>
    </div>
  );
};
