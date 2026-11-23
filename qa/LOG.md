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
2026-11-22T22:36:46Z START qa-054 on qa/qa-054-unbalanced-table-environment-is-stored-a: Unbalanced table environment is stored as escaped text with no error
2026-11-22T22:39:12Z DONE qa-054 (tsc -b, npm test, smoke all green)
2026-11-22T22:45:05Z EXPLORE tables: 4 new items, agent exit 0
2026-11-22T22:45:19Z START qa-058 on qa/qa-058-colour-and-highlight-palettes-are-painte: Colour and highlight palettes are painted under their own backdrop, so no swatch is clickable
2026-11-22T22:47:43Z DONE qa-058 (tsc -b, npm test, smoke all green)
2026-11-22T22:48:16Z START qa-077 on qa/qa-077-apply-source-silently-deletes-the-insert: Apply source silently deletes the inserted table of contents
2026-11-22T22:51:01Z DONE qa-077 (tsc -b, npm test, smoke all green)
2026-11-22T22:51:35Z START qa-084 on qa/qa-084-deleted-table-is-resurrected-on-source-v: Deleted table is resurrected on source/visual switch
2026-11-22T22:55:02Z DONE qa-084 (tsc -b, npm test, smoke all green)
2026-11-22T22:55:35Z START qa-085 on qa/qa-085-single-column-latex-tabular-becomes-esca: Single-column LaTeX tabular becomes escaped plain text instead of a table
2026-11-22T22:57:41Z DONE qa-085 (tsc -b, npm test, smoke all green)
2026-11-22T23:05:47Z EXPLORE math: 2 new items, agent exit 0
2026-11-22T23:06:01Z START qa-086 on qa/qa-086-text-in-a-second-paragraph-of-a-table-ce: Text in a second paragraph of a table cell is dropped from LaTeX
2026-11-22T23:08:29Z DONE qa-086 (tsc -b, npm test, smoke all green)
2026-11-22T23:14:02Z DONE qa-004 (tsc -b, npm test, smoke all green)
2026-11-22T23:14:36Z START qa-005 on qa/qa-005-browser-demo-workspace-does-not-survive: Browser demo workspace does not survive a reload (everything is lost)
2026-11-22T23:21:22Z DONE qa-005 (tsc -b, npm test, smoke all green)
2026-11-22T23:21:56Z START qa-006 on qa/qa-006-zoom-has-no-keyboard-or-gesture-path-and: Zoom has no keyboard or gesture path and no fit-width
2026-11-22T23:22:31Z DONE qa-006 (tsc -b, npm test, smoke all green)
2026-11-22T23:22:51Z EXPLORE links-cites-footnotes: 0 new items, agent exit 1
2026-11-22T23:23:06Z START qa-011 on qa/qa-011-avatar-settings-button-is-dead: Avatar/settings button is dead
2026-11-22T23:23:40Z DONE qa-011 (tsc -b, npm test, smoke all green)
2026-11-22T23:24:14Z START qa-012 on qa/qa-012-outline-navigation-does-not-focus-the-ed: Outline navigation does not focus the editor on first use; typing is silently dropped
2026-11-22T23:24:49Z DONE qa-012 (tsc -b, npm test, smoke all green)
2026-11-22T23:25:23Z START qa-013 on qa/qa-013-link-dialog-writes-invalid-hrefs-without: Link dialog writes invalid hrefs without validation
2026-11-22T23:25:57Z DONE qa-013 (tsc -b, npm test, smoke all green)
2026-11-22T23:26:32Z START qa-014 on qa/qa-014-desktop-only-git-actions-throw-a-raw-typ: Desktop-only Git actions throw a raw TypeError into the UI
2026-11-22T23:27:06Z DONE qa-014 (tsc -b, npm test, smoke all green)
2026-11-22T23:27:26Z EXPLORE review: 0 new items, agent exit 1
2026-11-22T23:27:41Z START qa-015 on qa/qa-015-fetch-pull-push-are-silent-no-ops-ribbon: Fetch / Pull / Push are silent no-ops (ribbon Git tab and panel)
2026-11-22T23:28:15Z DONE qa-015 (tsc -b, npm test, smoke all green)
2026-11-22T23:28:49Z START qa-016 on qa/qa-016-change-tracking-reports-working-tree-cle: Change tracking reports 'Working tree clean' after real edits
2026-11-22T23:29:24Z DONE qa-016 (tsc -b, npm test, smoke all green)
2026-11-22T23:29:58Z START qa-017 on qa/qa-017-github-dialog-does-not-move-focus-into-t: GitHub dialog does not move focus into the dialog
2026-11-22T23:30:32Z DONE qa-017 (tsc -b, npm test, smoke all green)
2026-11-22T23:31:07Z START qa-025 on qa/qa-025-switching-visual-latex-visual-resets-the: Switching Visual->LaTeX->Visual resets the cursor to the start of the document, so the next insert lands in the wrong pl
2026-11-22T23:31:41Z DONE qa-025 (tsc -b, npm test, smoke all green)
2026-11-22T23:32:01Z EXPLORE source-editor: 0 new items, agent exit 1
2026-11-22T23:32:15Z START qa-026 on qa/qa-026-image-inserted-mid-paragraph-splits-the: Image inserted mid-paragraph splits the paragraph at the cursor, breaking the sentence in two
2026-11-22T23:32:50Z DONE qa-026 (tsc -b, npm test, smoke all green)
2026-11-22T23:33:24Z START qa-027 on qa/qa-027-table-header-row-is-lost-in-latex-no-cap: Table header row is lost in LaTeX; no caption/label emitted
2026-11-22T23:33:58Z DONE qa-027 (tsc -b, npm test, smoke all green)
2026-11-22T23:34:33Z START qa-034 on qa/qa-034-single-column-latex-table-is-not-restore: Single-column LaTeX table is not restored as a table
2026-11-22T23:35:07Z DONE qa-034 (tsc -b, npm test, smoke all green)
2026-11-22T23:35:41Z START qa-035 on qa/qa-035-no-ui-controls-to-add-or-remove-table-ro: No UI controls to add or remove table rows or columns
2026-11-22T23:36:15Z DONE qa-035 (tsc -b, npm test, smoke all green)
2026-11-22T23:36:36Z EXPLORE long-document: 0 new items, agent exit 1
2026-11-22T23:36:50Z START qa-038 on qa/qa-038-undefined-control-sequence-in-math-is-ac: Undefined control sequence in math is accepted: no error flag and Insert stays enabled
2026-11-22T23:37:25Z DONE qa-038 (tsc -b, npm test, smoke all green)
2026-11-22T23:37:59Z START qa-039 on qa/qa-039-clicking-a-math-node-cancelling-the-edit: Clicking a math node, cancelling the edit dialog, then pressing Backspace does not delete it
2026-11-22T23:38:33Z DONE qa-039 (tsc -b, npm test, smoke all green)
2026-11-22T23:39:08Z START qa-043 on qa/qa-043-no-way-to-remove-a-link-without-deleting: No way to remove a link without deleting its text
2026-11-22T23:39:42Z DONE qa-043 (tsc -b, npm test, smoke all green)
2026-11-22T23:40:16Z START qa-044 on qa/qa-044-footnote-text-citation-keys-and-cross-re: Footnote text, citation keys and cross-reference labels have no visual edit flow
2026-11-22T23:40:51Z DONE qa-044 (tsc -b, npm test, smoke all green)
2026-11-22T23:41:11Z EXPLORE persistence: 0 new items, agent exit 1
2026-11-22T23:41:25Z START qa-051 on qa/qa-051-no-ui-to-reply-to-a-comment-thread: No UI to reply to a comment thread
2026-11-22T23:42:00Z DONE qa-051 (tsc -b, npm test, smoke all green)
2026-11-22T23:42:34Z START qa-055 on qa/qa-055-source-edits-in-split-mode-are-not-appli: Source edits in Split mode are not applied when switching to Visual
2026-11-22T23:43:08Z DONE qa-055 (tsc -b, npm test, smoke all green)
2026-11-22T23:43:43Z START qa-056 on qa/qa-056-clicking-the-active-latex-mode-button-di: Clicking the active LaTeX mode button discards unapplied source edits
2026-11-22T23:44:17Z DONE qa-056 (tsc -b, npm test, smoke all green)
2026-11-22T23:44:51Z START qa-057 on qa/qa-057-status-bar-page-count-ignores-page-break: Status bar page count ignores page breaks and visual document length
2026-11-22T23:45:26Z DONE qa-057 (tsc -b, npm test, smoke all green)
2026-11-22T23:45:46Z EXPLORE keyboard: 0 new items, agent exit 1
2026-11-22T23:46:00Z START qa-059 on qa/qa-059-paragraph-style-labels-are-off-by-one-le: Paragraph style labels are off by one level
2026-11-22T23:46:35Z DONE qa-059 (tsc -b, npm test, smoke all green)
2026-11-22T23:47:09Z START qa-060 on qa/qa-060-page-setup-paper-size-margins-text-size: Page setup (paper size, margins, text size, class) never changes the visible page
2026-11-22T23:47:43Z DONE qa-060 (tsc -b, npm test, smoke all green)
2026-11-22T23:48:18Z START qa-061 on qa/qa-061-add-link-with-no-selection-silently-inse: Add link with no selection silently inserts nothing
2026-11-22T23:48:52Z DONE qa-061 (tsc -b, npm test, smoke all green)
2026-11-22T23:49:26Z START qa-064 on qa/qa-064-paragraph-spacing-indented-vs-spaced-set: Paragraph spacing (indented vs spaced) setting is inert
2026-11-22T23:50:01Z DONE qa-064 (tsc -b, npm test, smoke all green)
2026-11-22T23:50:21Z EXPLORE insert-media: 0 new items, agent exit 1
2026-11-22T23:50:35Z START qa-072 on qa/qa-072-no-discoverable-control-to-switch-to-lat: no discoverable control to switch to LaTeX source view from the editor chrome
2026-11-22T23:51:10Z DONE qa-072 (tsc -b, npm test, smoke all green)
2026-11-22T23:51:44Z START qa-073 on qa/qa-073-escape-does-not-dismiss-the-colour-palet: Escape does not dismiss the colour-palette popover
2026-11-22T23:52:19Z DONE qa-073 (tsc -b, npm test, smoke all green)
2026-11-22T23:52:53Z START qa-074 on qa/qa-074-closing-a-modal-dialog-with-escape-drops: Closing a modal dialog with Escape drops keyboard focus to <body>
2026-11-22T23:53:28Z DONE qa-074 (tsc -b, npm test, smoke all green)
2026-11-22T23:54:02Z START qa-075 on qa/qa-075-github-auth-dialog-opens-without-moving: GitHub auth dialog opens without moving focus into it
2026-11-22T23:54:37Z DONE qa-075 (tsc -b, npm test, smoke all green)
2026-11-22T23:54:57Z EXPLORE lists: 0 new items, agent exit 1
2026-11-22T23:55:11Z START qa-078 on qa/qa-078-inserting-contents-immediately-after-a-p: Inserting Contents immediately after a page break replaces the new page break
2026-11-22T23:55:45Z DONE qa-078 (tsc -b, npm test, smoke all green)
2026-11-22T23:56:20Z START qa-079 on qa/qa-079-image-inserted-at-a-cursor-inside-a-para: Image inserted at a cursor inside a paragraph splits the sentence and exports a block figure
2026-11-22T23:56:54Z DONE qa-079 (tsc -b, npm test, smoke all green)
2026-11-22T23:57:28Z START qa-083 on qa/qa-083-select-all-list-toggle-does-not-convert: Select-all + list toggle does not convert a list to paragraphs; it appends an empty item
2026-11-22T23:58:03Z DONE qa-083 (tsc -b, npm test, smoke all green)
2026-11-22T23:58:37Z START qa-087 on qa/qa-087-no-visual-controls-to-add-or-remove-tabl: No visual controls to add or remove table rows or columns
2026-11-22T23:59:11Z DONE qa-087 (tsc -b, npm test, smoke all green)
2026-11-22T23:59:32Z EXPLORE tables: 0 new items, agent exit 1
2026-11-22T23:59:46Z START qa-088 on qa/qa-088-math-dialog-accepts-unknown-latex-comman: Math dialog accepts unknown LaTeX commands that KaTeX renders as errors
2026-11-23T00:00:20Z DONE qa-088 (tsc -b, npm test, smoke all green)
2026-11-23T00:00:55Z START qa-089 on qa/qa-089-math-node-cannot-be-removed-with-backspa: Math node cannot be removed with Backspace/Delete after closing its edit dialog
2026-11-23T00:01:29Z DONE qa-089 (tsc -b, npm test, smoke all green)
2026-11-23T00:02:03Z START qa-007 on qa/qa-007-start-screen-footer-is-hardcoded-sentenc: Start screen footer is hardcoded 'Sentence 0.1' while the app is 0.2.0
2026-11-23T00:02:37Z DONE qa-007 (tsc -b, npm test, smoke all green)
2026-11-23T00:03:12Z START qa-008 on qa/qa-008-no-print-path-ctrl-p-with-paper-accurate: No print path (Ctrl+P) with paper-accurate styles
2026-11-23T00:03:46Z DONE qa-008 (tsc -b, npm test, smoke all green)
2026-11-23T00:04:07Z EXPLORE math: 0 new items, agent exit 1
2026-11-23T00:04:21Z START qa-018 on qa/qa-018-inline-validation-error-not-announced: Inline validation error not announced
2026-11-23T00:04:55Z DONE qa-018 (tsc -b, npm test, smoke all green)
2026-11-23T00:05:30Z START qa-019 on qa/qa-019-ribbon-tabs-lack-tablist-semantics: Ribbon tabs lack tablist semantics
2026-11-23T00:06:04Z DONE qa-019 (tsc -b, npm test, smoke all green)
2026-11-23T00:06:38Z START qa-020 on qa/qa-020-word-count-excludes-the-paper-title-fron: Word count excludes the paper title/front matter
2026-11-23T00:07:13Z DONE qa-020 (tsc -b, npm test, smoke all green)
2026-11-23T00:07:47Z START qa-021 on qa/qa-021-submission-check-opens-the-arxiv-packag: 'Submission check' opens the arXiv package dialog and performs no check
2026-11-23T00:08:21Z DONE qa-021 (tsc -b, npm test, smoke all green)
2026-11-23T00:08:42Z EXPLORE links-cites-footnotes: 0 new items, agent exit 1
2026-11-23T00:08:56Z START qa-022 on qa/qa-022-track-changes-state-is-not-surfaced-outs: Track-changes state is not surfaced outside the button
2026-11-23T00:09:30Z DONE qa-022 (tsc -b, npm test, smoke all green)
2026-11-23T00:10:05Z START qa-023 on qa/qa-023-backdrop-click-does-not-dismiss-modals: Backdrop click does not dismiss modals
2026-11-23T00:10:39Z DONE qa-023 (tsc -b, npm test, smoke all green)
2026-11-23T00:11:13Z START qa-028 on qa/qa-028-adjacent-inline-atoms-are-emitted-glued: Adjacent inline atoms are emitted glued together
2026-11-23T00:11:48Z DONE qa-028 (tsc -b, npm test, smoke all green)
2026-11-23T00:12:22Z START qa-029 on qa/qa-029-all-images-forced-to-0-8-linewidth-capti: All images forced to 0.8\linewidth; caption is the raw filename
2026-11-23T00:12:56Z DONE qa-029 (tsc -b, npm test, smoke all green)
2026-11-23T00:17:17Z EXPLORE review: 4 new items, agent exit 0
2026-11-23T00:17:32Z START qa-090 on qa/qa-090-rejecting-an-older-tracked-revision-disc: Rejecting an older tracked revision discards later edits and resurrects previously rejected text
2026-11-23T00:25:55Z DONE qa-090 (tsc -b, npm test, smoke all green)
2026-11-23T00:26:29Z START qa-091 on qa/qa-091-no-ui-to-add-a-reply-to-a-comment-thread: No UI to add a reply to a comment thread
2026-11-23T00:31:59Z DONE qa-091 (tsc -b, npm test, smoke all green)
2026-11-23T00:32:33Z START qa-092 on qa/qa-092-deleting-a-comment-leaves-an-orphaned-hi: Deleting a comment leaves an orphaned highlight in the document
2026-11-23T00:35:32Z DONE qa-092 (tsc -b, npm test, smoke all green)
2026-11-23T00:36:07Z START qa-093 on qa/qa-093-rejecting-a-tracked-revision-leaves-a-st: Rejecting a tracked revision leaves a stale baseline for the next revision
2026-11-23T00:43:46Z DONE qa-093 (tsc -b, npm test, smoke all green)
2026-11-23T00:48:06Z EXPLORE source-editor: 2 new items, agent exit 0
2026-11-23T00:48:20Z START qa-094 on qa/qa-094-re-clicking-the-active-latex-mode-button: Re-clicking the active LaTeX mode button silently discards unapplied source edits
