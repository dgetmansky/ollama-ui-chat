#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

mkdir -p sessions

if [[ ! -d node_modules ]]; then
  npm install
fi

backend_pid=""
frontend_pid=""

terminate_pid() {
  local pid="$1"

  if [[ -z "${pid}" ]] || ! kill -0 "${pid}" 2>/dev/null; then
    return 0
  fi

  kill "${pid}" 2>/dev/null || true

  local attempts=10
  while (( attempts > 0 )); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      break
    fi
    sleep 0.1
    attempts=$((attempts - 1))
  done

  if kill -0 "${pid}" 2>/dev/null; then
    kill -KILL "${pid}" 2>/dev/null || true
  fi

  wait "${pid}" 2>/dev/null || true
}

cleanup() {
  local pid
  for pid in "${frontend_pid}" "${backend_pid}"; do
    if [[ -n "${pid}" ]]; then
      terminate_pid "${pid}"
    fi
  done
}

trap cleanup EXIT INT TERM

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

wait_for_http() {
  local name="$1"
  local url="$2"
  local pid="$3"
  local attempts=200
  local status=1

  while (( attempts > 0 )); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      wait "${pid}" 2>/dev/null || status=$?
      echo "${name} failed before becoming ready (exit ${status})" >&2
      return "${status}"
    fi

    if curl -fsS --max-time 1 "${url}" >/dev/null; then
      return 0
    fi

    sleep 0.1
    attempts=$((attempts - 1))
  done

  echo "Timed out waiting for ${name} at ${url}" >&2
  return 1
}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to verify backend and frontend readiness." >&2
  exit 1
fi

if ! wait_for_http "backend" "http://127.0.0.1:4174/backend/health" "${backend_pid}"; then
  exit 1
fi

if ! wait_for_http "frontend" "http://127.0.0.1:4173/" "${frontend_pid}"; then
  exit 1
fi

echo "Ollama UI GDP: http://127.0.0.1:4173"

set +e
wait -n "${backend_pid}" "${frontend_pid}"
status=$?
set -e
exit "${status}"
