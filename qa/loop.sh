#!/usr/bin/env bash
# Infinite QA loop: explore, then fix, then repeat. Ctrl-C or `touch qa/STOP` to stop.
set -u
cd "$(dirname "$0")/.."
mkdir -p qa
i=0
while true; do
  [ -f qa/STOP ] && { echo "$(date -Is) STOP flag present, exiting"; exit 0; }
  i=$((i + 1))
  if [ $((i % 6)) -eq 1 ]; then
    python3 qa/explore.py || echo "$(date -Is) explore pass failed"
  fi
  python3 qa/cycle.py --cycles 1
  sleep 20
done
