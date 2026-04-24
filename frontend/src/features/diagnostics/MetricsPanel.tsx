type Props = {
  stats: Record<string, unknown>;
  metrics: Record<string, unknown>;
};

const toPrettyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const durationFields: Record<string, string> = {
  total_duration: "total_sec",
  load_duration: "load_sec",
  prompt_eval_duration: "prompt_eval_sec",
  eval_duration: "eval_sec"
};

const formatStats = (stats: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [
      durationFields[key] ?? key,
      typeof value === "number" && key in durationFields ? roundToTwo(value / 1_000_000_000) : value
    ])
  );

const formatMetrics = (metrics: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      typeof value === "number" ? roundToTwo(value) : value
    ])
  );

export const MetricsPanel = ({ stats, metrics }: Props) => (
  <aside className="panel metrics-panel">
    <section>
      <h2>Stats</h2>
      <pre>{toPrettyJson(formatStats(stats))}</pre>
    </section>
    <section>
      <h2>Derived metrics</h2>
      <pre>{toPrettyJson(formatMetrics(metrics))}</pre>
    </section>
  </aside>
);
