import { useState, type FormEvent } from "react";
import type { SessionMessage } from "../../lib/types";

type Props = {
  messages: SessionMessage[];
  onSend: (prompt: string) => Promise<void>;
};

export const ChatPanel = ({ messages, onSend }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || pending) {
      return;
    }

    setPending(true);
    setPrompt("");
    try {
      await onSend(trimmedPrompt);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="panel chat-panel">
      <div className="messages">
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`message message-${message.role}`}>
            <strong>{message.role === "user" ? "User" : "Assistant"}</strong>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          aria-label="Prompt"
          placeholder="Send a prompt to Ollama"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="chat-actions">
          <button type="submit" disabled={pending}>
            Send
          </button>
          <button type="button">Stop</button>
        </div>
      </form>
    </main>
  );
};
