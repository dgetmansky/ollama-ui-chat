export type EndpointMode = "/api/chat" | "/api/generate";

export type SessionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SessionRecord = {
  id: string;
  endpoint: EndpointMode;
  model: string;
  stream: boolean;
  request_options: {
    num_predict: number;
    temperature: number;
  };
  messages: SessionMessage[];
  last_request: Record<string, unknown>;
  last_response: Record<string, unknown>;
  last_stats: Record<string, unknown>;
  derived_metrics: Record<string, unknown>;
};
