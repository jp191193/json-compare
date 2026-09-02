#!/usr/bin/env bash
set -euo pipefail

if redis-cli ping >/dev/null 2>&1; then
  echo "Redis is already running"
  exit 0
fi

redis-server --daemonize yes

for _ in $(seq 1 30); do
  if redis-cli ping >/dev/null 2>&1; then
    echo "Redis is ready"
    exit 0
  fi
  sleep 0.5
done

echo "Redis failed to start" >&2
exit 1
