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
  }
});
