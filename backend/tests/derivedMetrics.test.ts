import { describe, expect, it } from "vitest";
import { deriveMetrics } from "../src/metrics/derivedMetrics.js";

describe("deriveMetrics", () => {
  it("calculates duration and token metrics from Ollama stats", () => {
    expect(
      deriveMetrics({
        total_duration: 5_000_000_000,
        load_duration: 1_000_000_000,
        prompt_eval_count: 100,
        prompt_eval_duration: 2_000_000_000,
        eval_count: 60,
        eval_duration: 3_000_000_000
      })
    ).toEqual({
      total_sec: 5,
      load_sec: 1,
      prompt_tokens_per_sec: 50,
      eval_tokens_per_sec: 20
    });
  });

  it("returns null token rates when durations are missing, undefined, or zero", () => {
    expect(
      deriveMetrics({
        total_duration: 1_000_000_000,
        load_duration: 0,
        prompt_eval_count: 10,
        eval_count: 5
      })
    ).toEqual({
      total_sec: 1,
      load_sec: 0,
      prompt_tokens_per_sec: null,
      eval_tokens_per_sec: null
    });

    expect(
      deriveMetrics({
        total_duration: 1_000_000_000,
        load_duration: 0,
        prompt_eval_count: 10,
        prompt_eval_duration: 0,
        eval_count: 5,
        eval_duration: 0
      })
    ).toEqual({
      total_sec: 1,
      load_sec: 0,
      prompt_tokens_per_sec: null,
      eval_tokens_per_sec: null
    });
  });
});
