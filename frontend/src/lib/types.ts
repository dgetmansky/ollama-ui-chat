export type EndpointMode = "/api/chat" | "/api/generate";

export type SessionMessage = {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
};

export type SessionRecord = {
  id: string;
  endpoint: EndpointMode;
  model: string;
  stream: boolean;
  think?: boolean;
  request_options: {
    num_ctx?: number;
    num_predict: number;
    temperature: number;
  };
  history?: {
    max_messages: number;
    include_thinking: boolean;
  };
  messages: SessionMessage[];
  last_request: Record<string, unknown>;
  last_response: Record<string, unknown>;
  last_stats: Record<string, unknown>;
  derived_metrics: Record<string, unknown>;
};
