#!/usr/bin/env python3
"""Turn the last smoke report into backlog items. Idempotent: an observation
already queued (matched on its normalised note) is not queued twice."""

import json
import re
from pathlib import Path

QA = Path(__file__).resolve().parent
BACKLOG = QA / "backlog.json"
REPORT = QA / "report.json"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:30]


def main() -> None:
    if not REPORT.exists():
        return
    report = json.loads(REPORT.read_text())
    data = json.loads(BACKLOG.read_text())
    known = {i.get("source", "") for i in data["items"]}
    known |= {i["title"].strip().lower() for i in data["items"]}
    ids = {int(i["id"].split("-")[1]) for i in data["items"] if i["id"].startswith("qa-")}
    next_id = max(ids, default=0) + 1

    # A red gate is always the highest priority work.
    if report.get("failures"):
        for f in report["failures"]:
            key = f"smoke-fail:{f['check']}"
            if key in known:
                continue
            data["items"].append({
                "id": f"qa-{next_id:03d}",
                "title": f"Fix failing smoke check: {f['check']}",
                "why": "The automated gate is red; nothing else can be trusted until it is green.",
                "severity": "critical",
                "files": ["qa/smoke.mjs", "src"],
                "hint": f"Detail: {f.get('detail')}",
                "source": key,
                "status": "open",
            })
            next_id += 1

    for o in report.get("observations", []):
        key = o["note"].strip().lower()
        if key in known:
            continue
        data["items"].append({
            "id": f"qa-{next_id:03d}",
            "title": o["note"][:120],
            "why": f"Found by the automated pass ({o['severity']}/{o['category']}).",
            "severity": o["severity"],
            "files": ["src"],
            "hint": o.get("evidence") or "",
            "source": key,
            "status": "open",
        })
        next_id += 1

    BACKLOG.write_text(json.dumps(data, indent=2) + "\n")
    open_items = sum(1 for i in data["items"] if i["status"] == "open")
    print(f"backlog: {len(data['items'])} items, {open_items} open")


if __name__ == "__main__":
    main()
