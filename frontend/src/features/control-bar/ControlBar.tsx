type Props = {
  endpoint: "/api/chat" | "/api/generate";
  model: string;
  stream: boolean;
  numPredict: number;
  temperature: number;
};

export const ControlBar = ({ endpoint, model, stream, numPredict, temperature }: Props) => (
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
      <input aria-label="Model" value={model} onChange={() => undefined} />
    </label>
    <label>
      <span>Stream</span>
      <input type="checkbox" checked={stream} onChange={() => undefined} />
    </label>
    <label>
      <span>num_predict</span>
      <input value={numPredict} onChange={() => undefined} />
    </label>
    <label>
      <span>temperature</span>
      <input value={temperature} onChange={() => undefined} />
    </label>
    <button type="button">Refresh models</button>
    <button type="button">Ping</button>
    <button type="button">New session</button>
  </section>
);
