import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricsPanel } from "./MetricsPanel";

describe("MetricsPanel", () => {
  it("renders durations as seconds and rounds derived metrics", () => {
    render(
      <MetricsPanel
        stats={{
          total_duration: 19607732037,
          load_duration: 3856823832,
          prompt_eval_count: 20,
          prompt_eval_duration: 45368924,
          eval_count: 1374,
          eval_duration: 14687095043
        }}
        metrics={{
          total_sec: 19.607732037,
          load_sec: 3.856823832,
          prompt_tokens_per_sec: 440.830079,
          eval_tokens_per_sec: 93.552861
        }}
      />
    );

    const statsSection = screen.getByRole("heading", { name: "Stats" }).closest("section");
    const metricsSection = screen.getByRole("heading", { name: "Derived metrics" }).closest("section");

    expect(statsSection).not.toBeNull();
    expect(metricsSection).not.toBeNull();
    expect(within(statsSection as HTMLElement).getByText(/"total_sec": 19.61/)).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText(/"load_sec": 3.86/)).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText(/"prompt_eval_sec": 0.05/)).toBeInTheDocument();
    expect(within(statsSection as HTMLElement).getByText(/"eval_sec": 14.69/)).toBeInTheDocument();
    expect(within(metricsSection as HTMLElement).getByText(/"eval_tokens_per_sec": 93.55/)).toBeInTheDocument();
  });
});
