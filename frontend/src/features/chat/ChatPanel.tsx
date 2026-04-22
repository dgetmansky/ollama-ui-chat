import type { SessionMessage } from "../../lib/types";

type Props = {
  messages: SessionMessage[];
};

export const ChatPanel = ({ messages }: Props) => (
  <main className="panel chat-panel">
    <div className="messages">
      {messages.map((message, index) => (
        <article key={`${message.role}-${index}`} className={`message message-${message.role}`}>
          <strong>{message.role === "user" ? "User" : "Assistant"}</strong>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
    <textarea aria-label="Prompt" placeholder="Send a prompt to Ollama" />
    <div className="chat-actions">
      <button type="button">Send</button>
      <button type="button">Stop</button>
    </div>
  </main>
);
