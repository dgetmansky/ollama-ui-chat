type Props = {
  endpoint: "/api/chat" | "/api/generate";
  model: string;
  stream: boolean;
  numCtx?: number;
  numPredict: number;
  temperature: number;
  onRefreshModels: () => void;
  onPingBackend: () => void;
  onCreateNewSession: () => void;
};

export const ControlBar = ({
  endpoint,
  model,
  stream,
  numCtx,
  numPredict,
  temperature,
  onRefreshModels,
  onPingBackend,
  onCreateNewSession
}: Props) => (
  <section className="panel control-bar">
    <label>
      <span>Endpoint</span>
      <select aria-label="Endpoint" value={endpoint} onChange={() => undefined}>
        <option value="/api/chat">/api/chat</option>
        <option value="/api/generate">/api/generate</option>
      </select>
    </label>
    <label>
      <span>Model</span>
      <input aria-label="Model" readOnly value={model} onChange={() => undefined} />
    </label>
    <label>
      <span>Stream</span>
      <input type="checkbox" checked={stream} onChange={() => undefined} />
    </label>
    <label>
      <span>num_ctx</span>
      <input readOnly value={numCtx ?? ""} onChange={() => undefined} />
    </label>
    <label>
      <span>num_predict</span>
      <input readOnly value={numPredict} onChange={() => undefined} />
    </label>
    <label>
      <span>temperature</span>
      <input readOnly value={temperature} onChange={() => undefined} />
    </label>
    <button type="button" onClick={onRefreshModels}>
      Refresh models
    </button>
    <button type="button" onClick={onPingBackend}>
      Ping
    </button>
    <button type="button" onClick={onCreateNewSession}>
      New session
    </button>
  </section>
);
