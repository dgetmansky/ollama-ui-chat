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

  async runChat(payload: unknown) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`ollama_request_failed:${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  },

  async runGenerate(payload: unknown) {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`ollama_request_failed:${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
});
