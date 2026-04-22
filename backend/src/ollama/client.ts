type FetchOptions = {
  signal?: AbortSignal;
};

type StreamChunk = {
  response?: string;
  done?: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

const isStreamingPayload = (payload: unknown) =>
  typeof payload === "object" && payload !== null && "stream" in payload && (payload as { stream?: unknown }).stream === true;

const parseGenerateStream = (text: string) => {
  let responseText = "";
  let finalChunk: StreamChunk | null = null;
  let parsedChunkCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    try {
      const chunk = JSON.parse(trimmedLine) as StreamChunk;
      parsedChunkCount += 1;

      if (typeof chunk.response === "string") {
        responseText += chunk.response;
      }

      finalChunk = chunk;
    } catch {
      continue;
    }
  }

  if (parsedChunkCount === 0 || finalChunk === null) {
    throw new Error("Unable to parse streamed generate response");
  }

  return {
    ...finalChunk,
    response: responseText
  };
};

export const createOllamaClient = ({ baseUrl }: { baseUrl: string }) => ({
  async listModels() {
    const response = await fetch(`${baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(`ollama_request_failed:${response.status}`);
    }

    const body = (await response.json()) as { models?: Array<{ name: string }> };
    return body.models ?? [];
  },

  async ping() {
    const response = await fetch(`${baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(`ollama_unreachable:${response.status}`);
    }

    return { status: "ok" as const };
  },

  async runChat(payload: unknown, options: FetchOptions = {}) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`ollama_request_failed:${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  },

  async runGenerate(payload: unknown, options: FetchOptions = {}) {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`ollama_request_failed:${response.status}`);
    }

    if (isStreamingPayload(payload)) {
      const text = await response.text();
      return parseGenerateStream(text) as Record<string, unknown>;
    }

    return (await response.json()) as Record<string, unknown>;
  }
});
