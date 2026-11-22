#!/usr/bin/env python3
"""One cycle of the Sentence QA loop.

    test (scripted smoke)  ->  pick backlog item  ->  fix on a branch
    ->  verify (tsc -b, npm test, smoke)  ->  merge to main only if green

State lives in qa/backlog.json, history in qa/LOG.md. Run qa/loop.sh for the
infinite version. `python3 qa/cycle.py --once --dry-run` shows the next item.

ponytail: no task queue service, no daemon, no DB. One process, one lockfile,
JSON on disk — resumable by construction.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / "qa"
BACKLOG = QA / "backlog.json"
LOG = QA / "LOG.md"
CYCLE_LOGS = QA / "cycles"
MODEL = os.environ.get("QA_MODEL", "opencode/big-pickle")
PORT = 1420
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sh(cmd: str, timeout: int = 900, env: dict | None = None) -> tuple[int, str]:
    p = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True, timeout=timeout,
                       env={**os.environ, **(env or {})})
    return p.returncode, (p.stdout + p.stderr)


def log(msg: str) -> None:
    line = f"{now()} {msg}"
    print(line, flush=True)
    CYCLE_LOGS.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_backlog() -> dict:
    return json.loads(BACKLOG.read_text())


def save_backlog(data: dict) -> None:
    tmp = BACKLOG.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(BACKLOG)


def pick(data: dict) -> dict | None:
    items = [i for i in data["items"] if i.get("status") == "open"]
    items.sort(key=lambda i: (SEV_ORDER.get(i.get("severity", "low"), 9), i["id"]))
    return items[0] if items else None


def port_open() -> bool:
    # Ask the server over HTTP: a raw 127.0.0.1 socket misses Vite's [::1] bind,
    # and this also proves the app actually answers, not just that something listens.
    try:
        with urllib.request.urlopen(f"http://localhost:{PORT}/", timeout=2) as r:
            return r.status == 200
    except (OSError, urllib.error.URLError):
        return False


def ensure_server() -> tuple[bool, str]:
    if port_open():
        return True, "already running"
    CYCLE_LOGS.mkdir(parents=True, exist_ok=True)
    out = open(CYCLE_LOGS / "vite.log", "a")
    subprocess.Popen("npm run dev", shell=True, cwd=ROOT, stdout=out, stderr=out,
                     start_new_session=True)
    for _ in range(60):
        time.sleep(1)
        if port_open():
            return True, "started"
    return False, "vite did not come up on :1420"


def smoke() -> tuple[bool, str]:
    code, out = sh("node qa/smoke.mjs", timeout=600)
    return code == 0, out.strip()


def verify() -> tuple[bool, str]:
    results = []
    for label, cmd, timeout in [("tsc -b", "npx tsc -b", 300), ("npm test", "npm test", 300), ("smoke", "node qa/smoke.mjs", 600)]:
        code, out = sh(cmd, timeout=timeout)
        results.append((label, code, out))
        if code != 0:
            return False, "\n".join(f"== {l} EXIT {c}\n{o[-3000:]}" for l, c, o in results)
    return True, "tsc -b, npm test, smoke all green"


def git(*args: str, timeout: int = 120) -> tuple[int, str]:
    # list form: commit messages contain parentheses and quotes
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return p.returncode, (p.stdout + p.stderr)


def clean_tree() -> bool:
    # qa/ is the loop's own bookkeeping — it must not count as "the user is editing".
    code, out = git("status", "--porcelain", "--", ".", ":(exclude)qa")
    return code == 0 and out.strip() == ""


def prompt_for(item: dict, failures: str | None) -> str:
    retry = ""
    if failures:
        retry = ("\nThe previous attempt failed these checks. Fix the cause, do not weaken the checks:\n"
                 f"{failures[-2500:]}\n")
    return f"""You are implementing one backlog item in the Sentence repo at {ROOT} (Tauri 2 + React 19 + Tiptap 3, strict TypeScript, plain CSS in src/styles.css).

TASK {item['id']}: {item['title']}
WHY: {item.get('why', '')}
HINT: {item.get('hint', '')}
FILES LIKELY INVOLVED: {', '.join(item.get('files', [])) or 'read the code and find out'}
{retry}
RULES
- Smallest change that fully does the task. Match the existing code style (no formatter, no lint).
- TypeScript strict: `npx tsc -b` must exit 0. `npm test` must stay green.
- Do not edit qa/smoke.mjs or qa/cycle.py and do not weaken existing tests to make them pass.
- No new npm dependencies unless it is impossible without one.
- Accessibility and keyboard behaviour are part of "done" for UI work.
- Do not commit, do not create branches, do not run git.

When finished, reply with at most 6 lines: files changed, and what a user can now do that they could not before."""


def run_fixer(item: dict, failures: str | None, timeout: int = 2400) -> tuple[int, str]:
    p = subprocess.run(["opencode", "run", "-m", MODEL, prompt_for(item, failures)],
                       cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return p.returncode, (p.stdout + p.stderr)


def append_log(entry: dict) -> None:
    CYCLE_LOGS.mkdir(parents=True, exist_ok=True)
    with open(CYCLE_LOGS / f"{entry['id']}.log", "a") as f:
        f.write(json.dumps(entry, indent=2) + "\n")


def promote_from_roadmap(data: dict) -> dict | None:
    """Backlog dry? Pull the next roadmap feature in as a normal item, so the
    loop keeps moving toward Word parity instead of idling."""
    path = QA / "roadmap.json"
    if not path.exists():
        return None
    roadmap = json.loads(path.read_text())["items"]
    titles = {i["title"].strip().lower() for i in data["items"]}
    ids = [int(i["id"].split("-")[1]) for i in data["items"] if i["id"].startswith("qa-")]
    next_id = max(ids, default=0) + 1
    for feat in roadmap:
        if feat["title"].strip().lower() in titles:
            continue
        item = {
            "id": f"qa-{next_id:03d}",
            "title": feat["title"],
            "why": feat.get("why", ""),
            "severity": feat.get("severity", "medium"),
            "files": ["src"],
            "hint": feat.get("hint", ""),
            "source": f"roadmap:{feat['title'].lower()}",
            "status": "open",
        }
        data["items"].append(item)
        save_backlog(data)
        log(f"PROMOTED from roadmap: {item['id']} {item['title']}")
        return item
    return None


def cycle(dry_run: bool = False) -> str:
    ok, msg = ensure_server()
    if not ok:
        log(f"SERVER FAIL {msg}")
        return "server-fail"

    gate_ok, gate_out = smoke()
    if not gate_ok:
        # A red gate is the work, not a reason to stall: triage turns the failure
        # into a critical item and the normal flow below picks it up.
        log(f"SMOKE RED — queueing the failure as critical work: {gate_out[-400:]}")
        subprocess.run([sys.executable, str(QA / "triage.py")], cwd=ROOT)

    data = load_backlog()
    try:
        import explore  # sibling module; cycle.py always runs as qa/cycle.py
        added = explore.merge_pending()
        if added:
            log(f"IMPORTED {added} tester findings into the backlog")
            data = load_backlog()
    except Exception as exc:  # never let intake break the loop
        log(f"IMPORT FAIL {exc}")

    # Supervisor overrides queued as a file so they never race the loop's writes.
    requeue = QA / "requeue.json"
    if requeue.exists():
        try:
            for fix in json.loads(requeue.read_text()):
                for i in data["items"]:
                    if i["id"] == fix["id"]:
                        i.update({k: v for k, v in fix.items() if k != "id"})
                        log(f"REQUEUE {i['id']} -> {i['status']} ({fix.get('note', '')})")
            requeue.unlink()
            save_backlog(data)
        except Exception as exc:
            log(f"REQUEUE FAIL {exc}")

    item = pick(data)
    if not item:
        item = promote_from_roadmap(data)
    if not item:
        log("BACKLOG EMPTY — nothing open, idle")
        return "idle"

    if dry_run:
        print(json.dumps(item, indent=2))
        return "dry-run"

    if not clean_tree():
        log(f"DIRTY TREE before {item['id']} — stashing so the loop can continue")
        stash_msg = f"qa-loop-autostash-{now()}"
        code, out = git("stash", "push", "-u", "-m", stash_msg)
        if code == 0:
            log(f"STASHED as '{stash_msg}' (recover with git stash list)")

    branch = f"qa/{item['id']}-{re.sub(r'[^a-z0-9]+', '-', item['title'].lower())[:40].strip('-')}"
    item["status"] = "in_progress"
    item["attempts"] = item.get("attempts", 0)
    item["startedAt"] = now()
    save_backlog(data)

    code, out = git("checkout", "-B", branch, "main")
    if code != 0:
        log(f"BRANCH FAIL {branch}: {out[-400:]}")
        return "branch-fail"
    log(f"START {item['id']} on {branch}: {item['title']}")

    failures: str | None = None
    for attempt in range(1, int(item.get("max_attempts", 2)) + 1):
        item["attempts"] = attempt
        item["lastAttemptAt"] = now()
        save_backlog(data)
        try:
            rc, fout = run_fixer(item, failures)
        except subprocess.TimeoutExpired:
            rc, fout = 124, "opencode run timed out"
        append_log({"id": item["id"], "attempt": attempt, "branch": branch, "opencode_exit": rc, "output": fout[-6000:]})

        green, detail = verify()
        if green:
            git("add", "-A")
            commit_code, commit_out = git("commit", "-m", f"{item['id']}: {item['title']}")
            if commit_code != 0:
                append_log({"id": item["id"], "attempt": attempt, "commit_error": commit_out})
                log(f"COMMIT FAIL {item['id']}: {commit_out[-300:]}")
                git("checkout", "main")
                continue
            git("checkout", "main")
            merge_code, merge_out = git("merge", "--no-ff", branch, "-m", f"merge {item['id']}: {item['title']}")
            if merge_code != 0:
                git("merge", "--abort")
                git("checkout", "main")
                log(f"MERGE FAIL {item['id']}: {merge_out[-400:]}")
                item["status"] = "blocked"
                save_backlog(data)
                return "merge-fail"
            post_ok, post_out = verify()
            item["status"] = "done" if post_ok else "regressed"
            item["doneAt"] = now()
            save_backlog(data)
            log(f"DONE {item['id']} ({detail if post_ok else 'post-merge verify failed'})")
            return "done" if post_ok else "regressed"

        failures = detail
        log(f"ATTEMPT {attempt} red for {item['id']}: {detail.splitlines()[0] if detail else 'no output'}")
        git("checkout", "--", ".")
        git("clean", "-fd", "--", "src", "qa/shots")

    item["status"] = "blocked"
    item["lastFailure"] = (failures or "")[-1500:]
    save_backlog(data)
    # Keep the failed work: a WIP commit on the branch is what a reviewer (or the
    # next attempt) needs — reverting it threw away two attempts of work.
    git("add", "-A")
    wip_code, wip_out = git("commit", "-m", f"wip {item['id']}: {item['title']} (unverified)")
    git("checkout", "main")
    log(f"BLOCKED {item['id']} after {item['attempts']} attempts — branch {branch} kept"
        + ("" if wip_code == 0 else f" (could not commit WIP: {wip_out[-200:]})"))
    return "blocked"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cycles", type=int, default=0, help="0 = forever")
    args = ap.parse_args()

    QA.mkdir(exist_ok=True)
    lock = open(QA / ".loop.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("another cycle holds qa/.loop.lock — exiting")
        return

    n = 0
    try:
        while args.cycles == 0 or n < args.cycles:
            n += 1
            outcome = cycle(dry_run=args.dry_run)
            if args.dry_run:
                return
            if outcome == "idle":
                # Nothing queued: reseed from the last smoke report and wait.
                subprocess.run([sys.executable, str(QA / "triage.py")], cwd=ROOT)
                time.sleep(120)
            elif outcome in ("blocked", "merge-fail", "regressed", "branch-fail"):
                time.sleep(30)
    except KeyboardInterrupt:
        log("loop interrupted")
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)


if __name__ == "__main__":
    main()
