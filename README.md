# Ollama UI Chat

🚧 **Work in Progress**

Chat UI for local LLMs via Ollama.
Self-hosted, privacy-first, simple to run.

---

## 🧠 What is this?

This project provides a minimal UI + backend to interact with **local LLM models** via [Ollama](https://ollama.ai).

### Goals

* 🔒 Fully local (no cloud, no data sharing)
* ⚡ Simple and hackable architecture
* 🧩 Easy integration with Ollama
* 💬 Lightweight chat interface

---

## ⚡ Quick Start

### 1. Install Ollama

https://ollama.ai

### 2. Run a model

```bash
ollama run llama3
```

### 3. Start the app

```bash
./run.sh
```

### 4. Open in browser

```
http://localhost:3000
```

---

## 🏗 Project Structure

```
frontend/   - UI (TypeScript)
backend/    - API layer (Ollama integration)
sessions/   - local chat storage
docs/       - documentation (optional)
```

---

## ⚙️ Configuration

Basic configuration is stored in:

```
config.json
```

Example:

```json
{
  "ollamaUrl": "http://localhost:11434",
  "model": "llama3"
}
```

---

## 📌 Requirements

* Ollama running locally
* Node.js (for frontend)
* Bash environment (for `run.sh`)

---

## 🧪 Dev Notes

* Default port: `3000`
* Ollama API: `http://localhost:11434`
* Entry point: `./run.sh`
* Config file: `config.json`

---

## 🗺 Roadmap

* [ ] Streaming responses
* [ ] Multi-model support
* [ ] Improved UI/UX
* [ ] Docker setup
* [ ] Auth / multi-user support

---

## 🤝 Contributing

Contributions, ideas, and feedback are welcome.
Feel free to open issues or submit PRs.

---

## 📄 License

MIT
