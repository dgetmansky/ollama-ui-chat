import type { DerivedMetrics } from "../types/session.js";

type OllamaStats = {
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

const nsToSec = (value?: number): number | null =>
  typeof value === "number" ? value / 1_000_000_000 : null;

const safeRate = (count?: number, duration?: number): number | null => {
  if (typeof count !== "number" || typeof duration !== "number" || duration <= 0) {
    return null;
  }

  return count / (duration / 1_000_000_000);
};

export const deriveMetrics = (stats: OllamaStats): DerivedMetrics => ({
  total_sec: nsToSec(stats.total_duration),
  load_sec: nsToSec(stats.load_duration),
  prompt_tokens_per_sec: safeRate(stats.prompt_eval_count, stats.prompt_eval_duration),
  eval_tokens_per_sec: safeRate(stats.eval_count, stats.eval_duration)
});
