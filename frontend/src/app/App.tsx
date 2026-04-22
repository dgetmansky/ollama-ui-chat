import { ChatPanel } from "../features/chat/ChatPanel";
import { ControlBar } from "../features/control-bar/ControlBar";
import { DiagnosticsPanel } from "../features/diagnostics/DiagnosticsPanel";
import { SessionsPanel } from "../features/sessions/SessionsPanel";
import type { SessionRecord } from "../lib/types";

const mockSession: SessionRecord = {
  id: "2026-04-22T10-15-03-550e8400",
  endpoint: "/api/chat",
  model: "llama3.1:8b",
  stream: true,
  request_options: {
    num_predict: 256,
    temperature: 0.7
  },
  messages: [
    { role: "user", content: "Compare latency for this model." },
    {
      role: "assistant",
      content: "Latency is stable and prompt evaluation dominates the request."
    }
  ],
  last_request: { model: "llama3.1:8b", stream: true },
  last_response: { done: true, total_duration: 5000000000 },
  last_stats: { total_duration: 5000000000, eval_count: 60 },
  derived_metrics: { total_sec: 5, eval_tokens_per_sec: 20 }
};

export const App = () => (
  <div className="app-shell">
    <header className="app-header">
      <h1>Ollama UI GDP</h1>
      <span className="status-pill">Backend reachable</span>
    </header>
    <ControlBar
      endpoint={mockSession.endpoint}
      model={mockSession.model}
      stream={mockSession.stream}
      numPredict={mockSession.request_options.num_predict}
      temperature={mockSession.request_options.temperature}
    />
    <div className="content-grid">
      <SessionsPanel sessionIds={["2026-04-22T10-15-03-550e8400", "2026-04-22T11-20-14-550e8400"]} />
      <ChatPanel messages={mockSession.messages} />
      <DiagnosticsPanel
        requestPayload={mockSession.last_request}
        responsePayload={mockSession.last_response}
        stats={mockSession.last_stats}
        metrics={mockSession.derived_metrics}
      />
    </div>
  </div>
);
