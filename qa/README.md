# QA loop

Autonomous test→fix→verify loop for Sentence, running against the browser build
on Linux (the Tauri backend is stubbed, so desktop-only paths must degrade with a
message rather than crash).

```
qa/loop.sh                 infinite loop, one cycle at a time
qa/cycle.py --cycles 1     one cycle (what loop.sh calls)
qa/cycle.py --dry-run      show the next item without touching the repo
qa/smoke.mjs               the gate: drives Chromium, writes qa/report.json
qa/triage.py               turns report observations + failures into backlog items
qa/backlog.json            the queue
qa/LOG.md                  append-only history (committed)
qa/shots/, qa/cycles/      screenshots and per-cycle agent output (gitignored)
```

A cycle: ensure Vite on :1420 → run the smoke gate → take the highest-severity
open item → branch `qa/<id>-<slug>` → `opencode run` fixes it → verify
(`npx tsc -b`, `npm test`, `node qa/smoke.mjs`) → commit and merge to `main`
only if green → append to `qa/LOG.md`. Two failed attempts mark the item
`blocked` and leave the branch for review; `main` is never left red.

Stop it with `touch qa/STOP` (picked up between cycles) or Ctrl-C.
Override the fixer model with `QA_MODEL=opencode/<model>`.

Notes:
- One lockfile (`qa/.loop.lock`) — concurrent cycles exit immediately.
- `qa/` only dirties the tree harmlessly; uncommitted work **outside** `qa/` makes the loop idle instead of stashing it.
- Anything the smoke gate fails becomes a `critical` backlog item automatically.

## Verifying the Zotero import for real

`qa/mock-zotero.mjs` covers the parser. The local API itself is worth checking
once against the real client:

```sh
curl -sL -o /tmp/z.txz "https://www.zotero.org/download/client/dl?channel=release&platform=linux-x86_64"
tar -xf /tmp/z.txz -C /tmp && mkdir -p /tmp/zprof
printf '%s\n' 'user_pref("extensions.zotero.httpServer.enabled", true);' \
  'user_pref("extensions.zotero.httpServer.localAPI.enabled", true);' > /tmp/zprof/prefs.js
/tmp/Zotero_linux-x86_64/zotero -profile /tmp/zprof -no-remote &
# seed an item with POST /connector/saveItems, then:
ZOTERO_LIVE=1 cargo test --manifest-path src-tauri/Cargo.toml --lib zotero
```

Then kill Zotero and delete `/tmp/zprof`, `/tmp/zdata`, `/tmp/Zotero_linux-x86_64`.

