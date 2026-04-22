import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

createRoot(rootElement).render(
  <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
    <h1>Ollama UI GDP</h1>
    <p>Bootstrap placeholder runtime.</p>
  </main>
);
