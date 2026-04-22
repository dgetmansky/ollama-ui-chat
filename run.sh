#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

mkdir -p sessions

if [[ ! -f backend/src/index.ts || ! -f frontend/index.html || ! -f frontend/src/main.tsx ]]; then
  echo "Bootstrap incomplete: expected backend/src/index.ts, frontend/index.html, and frontend/src/main.tsx before starting the dev runtime." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

backend_pid=""
frontend_pid=""

cleanup() {
  local pid
  for pid in "${frontend_pid}" "${backend_pid}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

wait_for_startup() {
  local attempts=50

  while (( attempts > 0 )); do
    if ! kill -0 "${backend_pid}" 2>/dev/null; then
      return 1
    fi

    if ! kill -0 "${frontend_pid}" 2>/dev/null; then
      return 1
    fi

    sleep 0.1
    attempts=$((attempts - 1))
  done

  return 0
}

if ! wait_for_startup; then
  exit 1
fi

echo "Ollama UI GDP: http://127.0.0.1:4173"

while true; do
  if wait -n "${backend_pid}" "${frontend_pid}"; then
    child_status=0
  else
    child_status=$?
  fi

  if kill -0 "${backend_pid}" 2>/dev/null && kill -0 "${frontend_pid}" 2>/dev/null; then
    continue
  fi

  if [[ "${child_status}" -eq 0 ]]; then
    exit 1
  fi

  exit "${child_status}"
done
