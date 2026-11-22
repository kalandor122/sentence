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
