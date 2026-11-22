#!/usr/bin/env python3
"""Exploratory pass: an agent writes a Playwright probe for one untested area,
runs it against the live dev server, and its findings become backlog items.

    python3 qa/explore.py            # pick the least recently explored area
    python3 qa/explore.py tables     # force one area

The agent may only write under qa/probes/ and qa/findings/ — it never touches
src/, so a probe can't "fix" what it is supposed to be measuring.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / "qa"
AREAS = QA / "areas.json"
PROBES = QA / "probes"
FINDINGS = QA / "findings"
BACKLOG = QA / "backlog.json"
MODEL = os.environ.get("QA_MODEL", "opencode/big-pickle")


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prompt(area: dict) -> str:
    return f"""You are the tester in an automated QA loop for Sentence, a Word-like visual LaTeX editor
(React 19 + Tiptap 3 + Tauri 2) at {ROOT}. A Vite dev server is already running at http://localhost:1420.

AREA: {area['name']} — {area['brief']}

Your job is to find real defects in that area, with evidence.

STEP 1 — write a probe script `qa/probes/{area['id']}.mjs` (ESM) that imports the driver:
    import {{ drive, surface, type, bodyText, shot, BASE }} from "../lib/drive.mjs";
and exercises the area thoroughly: click real controls, type real text, read the DOM, and read the
generated LaTeX (switch to source view and read the textarea). `drive()` already opens the app and
enters the editor; it returns whatever your callback returns, and its second argument is an array of
console errors collected during the run.

STEP 2 — run it: `node qa/probes/{area['id']}.mjs`. Fix only your probe until it runs cleanly.

STEP 3 — write `qa/findings/{area['id']}.json` (create the directory) in exactly this shape:
{{"area": "{area['id']}", "checkedAt": "{now()}", "findings": [
  {{"title": "short defect title", "severity": "critical|high|medium|low",
    "category": "functional|visual|ux|content|console",
    "repro": "exact steps", "expected": "...", "actual": "..."}}
]}}

RULES
- Only write files under qa/probes/ and qa/findings/. Never edit src/, qa/smoke.mjs, qa/cycle.py or qa/backlog.json.
- Report only what your probe actually observed. No speculation, no "might be".
- A finding must be reproducible from the steps you write down.
- If the area works, return an empty findings list — that is a valid, useful result.
- Do not test desktop-only actions for existence of the Tauri backend; browser stubs are expected.
- At most 10 findings, highest severity first. Do not pad.

Finish by replying with one line: area, number of findings, worst severity."""


def pick_area(forced: str | None) -> dict:
    areas = json.loads(AREAS.read_text())["areas"]
    state = json.loads((QA / "explored.json").read_text()) if (QA / "explored.json").exists() else {}
    if forced:
        for a in areas:
            if a["id"] == forced:
                return a
        raise SystemExit(f"unknown area {forced}")
    areas.sort(key=lambda a: state.get(a["id"], ""))
    return areas[0]


def merge(area_id: str, path: Path) -> int:
    data = json.loads(path.read_text())
    backlog = json.loads(BACKLOG.read_text())
    known = {i["title"].strip().lower() for i in backlog["items"]}
    ids = [int(i["id"].split("-")[1]) for i in backlog["items"] if i["id"].startswith("qa-")]
    next_id = max(ids, default=0) + 1
    added = 0
    for f in data.get("findings", []):
        title = str(f.get("title", "")).strip()[:120]
        if not title or title.lower() in known:
            continue
        backlog["items"].append({
            "id": f"qa-{next_id:03d}",
            "title": title,
            "why": f"Exploratory pass on {area_id} ({f.get('category', 'functional')}): expected {f.get('expected')}",
            "severity": f.get("severity", "medium") if f.get("severity") in ("critical", "high", "medium", "low") else "medium",
            "files": ["src"],
            "hint": f"Repro: {f.get('repro')}\nActual: {f.get('actual')}",
            "source": f"explore:{area_id}:{title.lower()}",
            "status": "open",
        })
        known.add(title.lower())
        next_id += 1
        added += 1
    BACKLOG.write_text(json.dumps(backlog, indent=2) + "\n")
    return added


def merge_pending() -> int:
    """Merge every qa/findings/*.json that came from a tester (explore.py's own
    merge is idempotent, so double-merging is harmless). Files are kept as the
    evidence trail, never deleted."""
    added = 0
    for path in sorted(FINDINGS.glob("*.json")):
        try:
            added += merge(path.stem, path)
        except (json.JSONDecodeError, KeyError) as exc:
            print(f"skip {path}: {exc}")
    return added


def main() -> None:
    PROBES.mkdir(exist_ok=True)
    FINDINGS.mkdir(exist_ok=True)

    # Import a findings file produced elsewhere (e.g. a human or subagent report).
    if len(sys.argv) > 2 and sys.argv[1] == "--merge":
        path = Path(sys.argv[2])
        n = merge(path.stem, path)
        print(f"merged {n} findings from {path}")
        return

    area = pick_area(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"{now()} EXPLORE {area['id']}", flush=True)

    out = subprocess.run(["opencode", "run", "-m", MODEL, prompt(area)],
                         cwd=ROOT, capture_output=True, text=True, timeout=3600)
    (QA / "cycles").mkdir(exist_ok=True)
    (QA / "cycles" / f"explore-{area['id']}.log").write_text(out.stdout + out.stderr)

    findings_file = FINDINGS / f"{area['id']}.json"
    added = merge(area["id"], findings_file) if findings_file.exists() else 0
    state = json.loads((QA / "explored.json").read_text()) if (QA / "explored.json").exists() else {}
    state[area["id"]] = now()
    (QA / "explored.json").write_text(json.dumps(state, indent=2) + "\n")

    with open(QA / "LOG.md", "a") as f:
        f.write(f"{now()} EXPLORE {area['id']}: {added} new items, agent exit {out.returncode}\n")
    print(f"{now()} EXPLORE {area['id']} done: {added} new backlog items (exit {out.returncode})")


if __name__ == "__main__":
    main()
