#!/usr/bin/env bash
# Keep the QA loop alive. Cron calls this every 15 minutes; it starts the loop
# only if nothing is running and the operator has not dropped qa/STOP.
export PATH="$HOME/.local/share/mise/installs/node/latest/bin:$HOME/.local/share/mise/shims:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
cd /home/magor/Projects/sentence || exit 1
[ -f qa/STOP ] && exit 0
pgrep -f "qa/loop.sh" >/dev/null 2>&1 && exit 0
pgrep -f "qa/cycle.py" >/dev/null 2>&1 && exit 0
pgrep -f "qa/explore.py" >/dev/null 2>&1 && exit 0
mkdir -p qa/cycles
setsid nohup bash qa/loop.sh >> qa/cycles/loop.log 2>&1 < /dev/null &
echo "$(date -Is) watchdog started the loop"
