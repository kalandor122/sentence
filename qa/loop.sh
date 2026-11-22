#!/usr/bin/env bash
# Infinite QA loop: one cycle at a time, forever. Ctrl-C or `touch qa/STOP` to stop.
set -u
cd "$(dirname "$0")/.."
mkdir -p qa
while true; do
  [ -f qa/STOP ] && { echo "$(date -Is) STOP flag present, exiting"; exit 0; }
  python3 qa/cycle.py --cycles 1
  sleep 20
done
