2026-11-22T19:47:59Z START qa-001 on qa/qa-001-ribbon-clips-its-primary-action-at-1280p: Ribbon clips its primary action at 1280px (Compile cut off)
2026-11-22T19:54:07Z MERGE FAIL qa-001: /bin/sh: -c: line 1: syntax error near unexpected token `('
/bin/sh: -c: line 1: `git merge --no-ff qa/qa-001-ribbon-clips-its-primary-action-at-1280p -m merge qa-001: Ribbon clips its primary action at 1280px (Compile cut off)'

2026-11-22T20:09:41Z EXPLORE lists: 1 new items, agent exit 0
2026-11-22T20:17:31Z EXPLORE tables: 4 new items, agent exit 0
2026-11-22T20:18:31Z SERVER FAIL vite did not come up on :1420
2026-11-22T20:19:51Z SERVER FAIL vite did not come up on :1420
2026-11-22T20:21:11Z SERVER FAIL vite did not come up on :1420
2026-11-22T20:22:31Z SERVER FAIL vite did not come up on :1420
2026-11-22T20:31:52Z EXPLORE math: 4 new items, agent exit 0
2026-11-22T20:32:00Z SMOKE RED before work — fix harness or app first: FAIL failures=1 observations=5 consoleErrors=0
  FAIL ribbon fits at 1280px on Home: offscreen=[Compile] contentOverflow=0px docOverflow=0px
2026-11-22T20:32:29Z SMOKE RED before work — fix harness or app first: FAIL failures=1 observations=5 consoleErrors=0
  FAIL ribbon fits at 1280px on Home: offscreen=[Compile] contentOverflow=0px docOverflow=0px
2026-11-22T20:32:57Z SMOKE RED before work — fix harness or app first: FAIL failures=1 observations=5 consoleErrors=0
  FAIL ribbon fits at 1280px on Home: offscreen=[Compile] contentOverflow=0px docOverflow=0px
2026-11-22T20:33:26Z SMOKE RED before work — fix harness or app first: FAIL failures=1 observations=5 consoleErrors=0
  FAIL ribbon fits at 1280px on Home: offscreen=[Compile] contentOverflow=0px docOverflow=0px
2026-11-22T20:35:51Z SUPERVISOR: app-shell grid column was implicit max-content, ribbon overflowed to 1336px at 1280 — fixed with grid-template-columns: minmax(0,1fr); gate green
2026-11-22T20:53:08Z BLOCKED qa-002 after 2 attempts — branch qa/qa-002-word-standard-editing-shortcuts-missing kept for review
2026-11-22T20:54:02Z START qa-003 on qa/qa-003-no-find-replace-ctrl-f-ctrl-h: No Find & Replace (Ctrl+F / Ctrl+H)
2026-11-22T21:01:31Z DONE qa-003 (tsc -b, npm test, smoke all green)
2026-11-22T21:01:55Z START qa-009 on qa/qa-009-nested-lists-are-destroyed-when-latex-so: Nested lists are destroyed when LaTeX source is applied
2026-11-22T21:04:16Z DONE qa-009 (tsc -b, npm test, smoke all green)
2026-11-22T21:04:41Z REQUEUE qa-002 -> open (retry: the earlier block was a harness bug (the Ctrl+K probe left the link dialog open and the compile click timed out); smoke now closes overlays between shortcut probes)
2026-11-22T21:04:41Z START qa-002 on qa/qa-002-word-standard-editing-shortcuts-missing: Word-standard editing shortcuts missing (Ctrl+K link, Ctrl+Shift+7/8 lists, Ctrl+1/2/5 spacing, Tab indent)
2026-11-22T21:13:04Z DONE qa-002 (tsc -b, npm test, smoke all green)
2026-11-22T21:17:01Z EXPLORE review: 1 new items, agent exit 0
2026-11-22T21:17:10Z START qa-010 on qa/qa-010-modals-do-not-trap-focus: Modals do not trap focus
2026-11-22T21:30:06Z STASHED as 'qa-loop-autostash-2026-11-22T21:30:06Z' (recover with git stash list)
2026-11-22T21:30:06Z BRANCH FAIL qa/qa-052-applying-latex-containing-texttt-wipes-t: error: Your local changes to the following files would be overwritten by checkout:
	qa/LOG.md
	qa/backlog.json
Please commit your changes or stash them before you switch branches.
Aborting

2026-11-22T21:31:05Z BRANCH FAIL qa/qa-032-applying-table-latex-drops-the-first-hea: error: Your local changes to the following files would be overwritten by checkout:
	qa/LOG.md
	qa/backlog.json
Please commit your changes or stash them before you switch branches.
Aborting

2026-11-22T21:32:04Z BRANCH FAIL qa/qa-033-escaped-ampersand-in-a-cell-corrupts-the: error: Your local changes to the following files would be overwritten by checkout:
	qa/LOG.md
	qa/backlog.json
Please commit your changes or stash them before you switch branches.
Aborting

2026-11-22T21:33:03Z BRANCH FAIL qa/qa-036-inline-math-from-latex-source-is-silent: error: Your local changes to the following files would be overwritten by checkout:
	qa/LOG.md
	qa/backlog.json
Please commit your changes or stash them before you switch branches.
Aborting

2026-11-22T21:38:55Z EXPLORE long-document: 1 new items, agent exit 0
2026-11-22T21:39:04Z START qa-052 on qa/qa-052-applying-latex-containing-texttt-wipes-t: Applying LaTeX containing \texttt wipes the entire visual document
2026-11-22T21:40:27Z DONE qa-052 (tsc -b, npm test, smoke all green)
2026-11-22T21:40:57Z START qa-024 on qa/qa-024-inserted-image-produces-uncompilable-lat: Inserted image produces uncompilable LaTeX: base64 data URI is used as the \includegraphics filename
2026-11-22T21:45:02Z DONE qa-024 (tsc -b, npm test, smoke all green)
2026-11-22T21:45:32Z START qa-032 on qa/qa-032-applying-table-latex-drops-the-first-hea: Applying table LaTeX drops the first/header row
2026-11-22T21:46:56Z DONE qa-032 (tsc -b, npm test, smoke all green)
2026-11-22T21:47:25Z IMPORTED 7 tester findings into the backlog
2026-11-22T21:47:25Z REQUEUE qa-048 -> superseded (line spacing actually works (setspace, 27.5->41.6px line-height); only paragraph spacing is inert, now queued separately)
2026-11-22T21:47:25Z START qa-033 on qa/qa-033-escaped-ampersand-in-a-cell-corrupts-the: Escaped ampersand in a cell corrupts the table on source round-trip
2026-11-22T21:48:21Z DONE qa-033 (tsc -b, npm test, smoke all green)
2026-11-22T21:52:42Z EXPLORE persistence: 2 new items, agent exit 0
2026-11-22T21:52:55Z SMOKE RED — queueing the failure as critical work: FAIL failures=2 observations=4 consoleErrors=0
  FAIL find reports a match count: No matches
  FAIL nested lists survive the source round trip: {"nested":0,"leaked":false}
2026-11-22T22:02:51Z EXPLORE keyboard: 4 new items, agent exit 0
2026-11-22T22:03:05Z DIRTY TREE before qa-068 — stashing so the loop can continue
2026-11-22T22:14:00Z EXPLORE insert-media: 5 new items, agent exit 0
2026-11-22T22:14:14Z START qa-036 on qa/qa-036-inline-math-from-latex-source-is-silent: $...$ inline math from LaTeX source is silently turned into escaped plain text
2026-11-22T22:15:32Z DONE qa-036 (tsc -b, npm test, smoke all green)
2026-11-22T22:16:06Z START qa-037 on qa/qa-037-numbered-equation-environment-from-latex: Numbered equation environment from LaTeX source is not recognized and is escaped as text
2026-11-22T22:17:40Z DONE qa-037 (tsc -b, npm test, smoke all green)
2026-11-22T22:18:13Z START qa-040 on qa/qa-040-href-from-latex-source-is-not-parsed-an: \href from LaTeX source is not parsed and links are destroyed on round-trip
2026-11-22T22:19:47Z DONE qa-040 (tsc -b, npm test, smoke all green)
2026-11-22T22:20:21Z IMPORTED 1 tester findings into the backlog
2026-11-22T22:20:21Z START qa-041 on qa/qa-041-ref-from-latex-source-is-not-parsed-and: \ref from LaTeX source is not parsed and cross-references are destroyed on round-trip
2026-11-22T22:21:44Z DONE qa-041 (tsc -b, npm test, smoke all green)
2026-11-22T22:27:46Z EXPLORE lists: 1 new items, agent exit 0
2026-11-22T22:27:59Z START qa-042 on qa/qa-042-citation-bibliography-directives-turn-in: Citation bibliography directives turn into escaped text and are duplicated when source is applied
2026-11-22T22:29:12Z DONE qa-042 (tsc -b, npm test, smoke all green)
2026-11-22T22:29:46Z START qa-047 on qa/qa-047-font-family-control-emits-unbraced-latex: Font family control emits unbraced LaTeX command
2026-11-22T22:31:57Z DONE qa-047 (tsc -b, npm test, smoke all green)
2026-11-22T22:32:30Z START qa-053 on qa/qa-053-malformed-latex-with-a-missing-end-docum: Malformed LaTeX with a missing \end{document} is applied silently and clears the document
2026-11-22T22:36:12Z DONE qa-053 (tsc -b, npm test, smoke all green)
