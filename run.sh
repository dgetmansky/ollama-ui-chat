#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

mkdir -p sessions

if [[ ! -d node_modules || ! -d frontend/node_modules || ! -d backend/node_modules ]]; then
  npm install
fi

backend_pid=""
frontend_pid=""

cleanup() {
  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
  fi
  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

echo "Ollama UI GDP: http://127.0.0.1:4173"
wait
