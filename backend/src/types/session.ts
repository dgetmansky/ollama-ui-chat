export type SessionMessageRole = "user" | "assistant";

export type SessionMessage = {
  role: SessionMessageRole;
  content: string;
};

export type RequestOptions = {
  num_predict: number;
  temperature: number;
};

export type DerivedMetrics = {
  total_sec: number | null;
  load_sec: number | null;
  prompt_tokens_per_sec: number | null;
  eval_tokens_per_sec: number | null;
};

export type SessionRuntime = {
  last_request_id: string | null;
  last_status: "idle" | "running" | "completed" | "aborted" | "failed";
};

export type StoredSession = {
  id: string;
  created_at: string;
  updated_at: string;
  endpoint: "/api/chat" | "/api/generate";
  model: string;
  stream: boolean;
  request_options: RequestOptions;
  messages: SessionMessage[];
  last_request: Record<string, unknown>;
  last_response: Record<string, unknown>;
  last_stats: Record<string, unknown>;
  derived_metrics: DerivedMetrics;
  runtime: SessionRuntime;
};
