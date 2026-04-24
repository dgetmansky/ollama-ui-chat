type Props = {
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
};

const toPrettyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export const DiagnosticsPanel = ({ requestPayload, responsePayload }: Props) => (
  <aside className="panel diagnostics-panel">
    <h2>Diagnostics</h2>
    <section>
      <h3>Last request payload</h3>
      <pre>{toPrettyJson(requestPayload)}</pre>
    </section>
    <section>
      <h3>Last response raw JSON</h3>
      <pre>{toPrettyJson(responsePayload)}</pre>
    </section>
  </aside>
);
