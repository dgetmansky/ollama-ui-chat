import { useEffect, useState } from "react";
import { ChatPanel } from "../features/chat/ChatPanel";
import { ControlBar } from "../features/control-bar/ControlBar";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { MetricsPanel } from "../features/diagnostics/MetricsPanel";
import { SessionsPanel } from "../features/sessions/SessionsPanel";
import { api } from "../lib/api";
import type { SessionRecord } from "../lib/types";

const emptySession: SessionRecord = {
  id: "",
  endpoint: "/api/chat",
  model: "",
  stream: false,
  think: true,
  request_options: {
    num_ctx: 32768,
    num_predict: 4096,
    temperature: 0.7
  },
  history: {
    max_messages: 20,
    include_thinking: false
  },
  messages: [],
  last_request: {},
  last_response: {},
  last_stats: {},
  derived_metrics: {}
};

const createRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const App = () => {
  const [models, setModels] = useState<Array<{ name: string }>>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [startupError, setStartupError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionStatus, setActionStatus] = useState("Idle");
  const [pendingRequestId, setPendingRequestId] = useState("");

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
        setActionError("");
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
      setActionError("");
      setActionStatus("Models refreshed");
    } catch (error) {
      setActionError(describeError(error, "Model refresh failed"));
    }
  };

  const pingBackend = async () => {
    try {
      const pingResponse = await api.ping();
      setActionError("");
      setActionStatus(
        typeof pingResponse.latency_ms === "number"
          ? `Ollama ping: ${pingResponse.latency_ms} ms`
          : "Ping successful"
      );
    } catch (error) {
      setActionError(describeError(error, "Ping failed"));
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
      setActionError("");
      setActionStatus("Session opened");
    } catch (error) {
      setActionError(describeError(error, "Open session failed"));
    }
  };

  const createNewSession = async () => {
    try {
      const session = await api.createSession();
      setSessions((currentSessions) => [session, ...currentSessions]);
      setActiveSessionId(session.id);
      setActionError("");
      setActionStatus("Session created");
    } catch (error) {
      setActionError(describeError(error, "Create session failed"));
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
      setActionError("");
      setActionStatus("Session deleted");
    } catch (error) {
      setActionError(describeError(error, "Delete session failed"));
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const sessionView = activeSession ?? sessions[0] ?? emptySession;
  const model = sessionView.model || models[0]?.name || "";

  const handleSend = async (prompt: string) => {
    if (!activeSession) {
      return;
    }

    const requestId = createRequestId();
    const sessionId = activeSession.id;
    setPendingRequestId(requestId);
    try {
      const response = await api.runSession(activeSession.id, {
        prompt,
        endpoint: activeSession.endpoint,
        model: activeSession.model || models[0]?.name || "",
        stream: activeSession.stream,
        think: activeSession.think,
        request_options: activeSession.request_options,
        request_id: requestId
      });

      setActionError("");
      setSessions((currentSessions) =>
        currentSessions.some((session) => session.id === sessionId)
          ? currentSessions.map((session) => (session.id === sessionId ? response.session : session))
          : currentSessions
      );
      setActionStatus("Send successful");
    } catch (error) {
      setActionError(describeError(error, "Send failed"));
      setActionStatus(error instanceof Error && error.name === "AbortError" ? "Request aborted" : "Send failed");
    } finally {
      setPendingRequestId((currentPendingRequestId) =>
        currentPendingRequestId === requestId ? "" : currentPendingRequestId
      );
    }
  };

  const handleStop = async (requestId: string) => {
    try {
      await api.abortRequest(requestId);
      setActionStatus("Cancellation requested");
    } catch (error) {
      setActionError(describeError(error, "Abort request failed"));
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ollama UI GDP</h1>
        <span className="status-pill">{startupError ? "Startup failed" : "Backend reachable"}</span>
        <span className="status-pill">{actionStatus ? `Action: ${actionStatus}` : "Action: Idle"}</span>
      </header>
      {startupError ? (
        <div role="alert" className="status-banner">
          {startupError}
        </div>
      ) : null}
      <ControlBar
        endpoint={sessionView.endpoint}
        model={model}
        stream={sessionView.stream}
        numCtx={sessionView.request_options.num_ctx}
        numPredict={sessionView.request_options.num_predict}
        temperature={sessionView.request_options.temperature}
        onRefreshModels={refreshModels}
        onPingBackend={pingBackend}
        onCreateNewSession={createNewSession}
      />
      <div className="content-grid">
        <div className="left-column">
          <MetricsPanel stats={sessionView.last_stats} metrics={sessionView.derived_metrics} />
          <SessionsPanel
            sessionIds={sessions.map((session) => session.id)}
            activeSessionId={activeSessionId}
            onSelectSession={openSession}
            onDeleteActiveSession={deleteActiveSession}
          />
        </div>
        <ChatPanel
          messages={sessionView.messages}
          errorMessage={actionError}
          onSend={handleSend}
          pendingRequestId={pendingRequestId}
          onStop={handleStop}
        />
        <DiagnosticsPanel
          requestPayload={sessionView.last_request}
          responsePayload={sessionView.last_response}
        />
      </div>
    </div>
  );
};
