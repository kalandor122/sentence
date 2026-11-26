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
2026-11-23T00:50:09Z DONE qa-094 (tsc -b, npm test, smoke all green)
2026-11-23T00:50:43Z START qa-030 on qa/qa-030-status-bar-page-count-ignores-page-break: Status bar page count ignores page breaks
2026-11-23T00:53:55Z DONE qa-030 (tsc -b, npm test, smoke all green)
2026-11-23T00:54:29Z START qa-031 on qa/qa-031-toc-block-is-an-empty-placeholder-in-the: TOC block is an empty placeholder in the visual editor
2026-11-23T00:58:31Z DONE qa-031 (tsc -b, npm test, smoke all green)
2026-11-23T00:59:06Z START qa-045 on qa/qa-045-add-link-dialog-does-not-prefill-the-exi: Add link dialog does not prefill the existing URL when editing a link
2026-11-23T01:02:11Z DONE qa-045 (tsc -b, npm test, smoke all green)
2026-11-23T01:09:58Z EXPLORE long-document: 0 new items, agent exit 0
2026-11-23T01:10:12Z START qa-046 on qa/qa-046-all-footnotes-render-the-marker-1-in-the: All footnotes render the marker 1 in the visual editor
2026-11-23T01:14:15Z DONE qa-046 (tsc -b, npm test, smoke all green)
2026-11-23T01:14:50Z START qa-049 on qa/qa-049-no-indent-outdent-controls-anywhere-in-t: No indent / outdent controls anywhere in the ribbon
2026-11-23T01:20:15Z DONE qa-049 (tsc -b, npm test, smoke all green)
2026-11-23T01:20:50Z START qa-050 on qa/qa-050-align-left-button-is-not-active-by-defau: Align left button is not active by default
2026-11-23T01:23:25Z DONE qa-050 (tsc -b, npm test, smoke all green)
2026-11-23T01:23:59Z START qa-062 on qa/qa-062-layout-tab-selects-are-unnamed-for-scree: Layout tab selects are unnamed for screen readers
2026-11-23T01:25:22Z DONE qa-062 (tsc -b, npm test, smoke all green)
2026-11-23T01:29:49Z EXPLORE persistence: 3 new items, agent exit 0
2026-11-23T01:30:03Z START qa-096 on qa/qa-096-edits-inside-the-autosave-debounce-are-l: Edits inside the autosave debounce are lost on reload with no warning
2026-11-23T01:32:42Z DONE qa-096 (tsc -b, npm test, smoke all green)
2026-11-23T01:33:17Z START qa-063 on qa/qa-063-inactive-ribbon-toggles-omit-aria-presse: Inactive ribbon toggles omit aria-pressed instead of reporting false
2026-11-23T01:35:19Z DONE qa-063 (tsc -b, npm test, smoke all green)
2026-11-23T01:35:48Z START qa-069 on qa/qa-069-start-screen-footer-shows-version-0-1-wh: start screen footer shows version 0.1 while package.json is 0.2.0 — hardcoded version?
2026-11-23T01:37:47Z DONE qa-069 (tsc -b, npm test, smoke all green)
2026-11-23T01:38:17Z START qa-070 on qa/qa-070-keyboard-shortcut-ctrl-k-link-has-no-vis: keyboard shortcut "Ctrl+K link" has no visible effect on the document
2026-11-23T01:45:19Z DONE qa-070 (tsc -b, npm test, smoke all green)
2026-11-23T01:48:55Z EXPLORE keyboard: 1 new items, agent exit 0
2026-11-23T01:49:05Z START qa-071 on qa/qa-071-keyboard-shortcut-ctrl-5-line-spacing-ha: keyboard shortcut "Ctrl+5 line spacing" has no visible effect on the document
2026-11-23T01:53:41Z DONE qa-071 (tsc -b, npm test, smoke all green)
2026-11-23T01:54:11Z START qa-076 on qa/qa-076-ribbon-tabs-lack-tab-semantics-and-arrow: Ribbon tabs lack tab semantics and arrow-key navigation
2026-11-23T01:55:34Z DONE qa-076 (tsc -b, npm test, smoke all green)
2026-11-23T01:56:04Z START qa-080 on qa/qa-080-status-bar-page-count-ignores-inserted-p: Status bar page count ignores inserted page breaks
2026-11-23T02:01:14Z DONE qa-080 (tsc -b, npm test, smoke all green)
2026-11-23T02:01:44Z START qa-081 on qa/qa-081-visual-table-of-contents-shows-no-entrie: Visual table of contents shows no entries for the document's headings
2026-11-23T02:06:21Z DONE qa-081 (tsc -b, npm test, smoke all green)
2026-11-23T02:11:42Z EXPLORE insert-media: 2 new items, agent exit 0
2026-11-23T02:11:52Z START qa-100 on qa/qa-100-a-second-page-furniture-command-replaces: A second page-furniture command replaces the previously inserted page break or contents block
2026-11-23T02:15:05Z DONE qa-100 (tsc -b, npm test, smoke all green)
2026-11-23T02:15:35Z START qa-101 on qa/qa-101-inserting-an-image-at-a-caret-inside-a-p: Inserting an image at a caret inside a paragraph splits the sentence into two paragraphs
2026-11-23T02:23:11Z DONE qa-101 (tsc -b, npm test, smoke all green)
2026-11-23T02:23:41Z START qa-082 on qa/qa-082-numbered-equations-lose-their-numbering: Numbered equations lose their numbering when copied or pasted
2026-11-23T02:28:10Z DONE qa-082 (tsc -b, npm test, smoke all green)
2026-11-23T02:28:40Z START qa-095 on qa/qa-095-ctrl-z-in-the-source-textarea-undoes-one: Ctrl+Z in the source textarea undoes one character at a time instead of the typed token
2026-11-23T02:38:02Z DONE qa-095 (tsc -b, npm test, smoke all green)
2026-11-23T02:43:20Z EXPLORE lists: 2 new items, agent exit 0
2026-11-23T02:43:29Z START qa-102 on qa/qa-102-select-all-list-toggle-does-not-convert: Select-all + list toggle does not convert a list to paragraphs; it adds an empty item
2026-11-23T02:47:53Z DONE qa-102 (tsc -b, npm test, smoke all green)
2026-11-23T02:48:23Z START qa-103 on qa/qa-103-ordered-list-start-number-is-dropped-fro: Ordered list start number is dropped from LaTeX
2026-11-23T02:52:28Z DONE qa-103 (tsc -b, npm test, smoke all green)
2026-11-23T02:52:57Z START qa-097 on qa/qa-097-undo-appears-enabled-but-is-a-no-op-afte: Undo appears enabled but is a no-op after reload
2026-11-23T02:55:20Z DONE qa-097 (tsc -b, npm test, smoke all green)
2026-11-23T02:55:50Z START qa-098 on qa/qa-098-a-restored-source-edited-document-is-mar: A restored source-edited document is marked dirty and silently rewritten
2026-11-23T03:00:52Z DONE qa-098 (tsc -b, npm test, smoke all green)
2026-11-23T03:15:58Z EXPLORE tables: 0 new items, agent exit 0
2026-11-23T03:16:08Z START qa-099 on qa/qa-099-settings-button-is-not-activated-by-ente: Settings button is not activated by Enter when focused
2026-11-23T03:19:07Z DONE qa-099 (tsc -b, npm test, smoke all green)
2026-11-23T03:19:37Z PROMOTED from roadmap: qa-104 Table editing: a contextual table toolbar
2026-11-23T03:19:37Z START qa-104 on qa/qa-104-table-editing-a-contextual-table-toolbar: Table editing: a contextual table toolbar
2026-11-23T03:28:13Z DONE qa-104 (tsc -b, npm test, smoke all green)
2026-11-23T03:28:43Z PROMOTED from roadmap: qa-105 Spell check that respects the LaTeX source
2026-11-23T03:28:43Z START qa-105 on qa/qa-105-spell-check-that-respects-the-latex-sour: Spell check that respects the LaTeX source
2026-11-23T03:33:39Z DONE qa-105 (tsc -b, npm test, smoke all green)
2026-11-23T03:34:09Z PROMOTED from roadmap: qa-106 Real pagination in the visual editor
2026-11-23T03:34:09Z START qa-106 on qa/qa-106-real-pagination-in-the-visual-editor: Real pagination in the visual editor
2026-11-23T03:41:35Z DONE qa-106 (tsc -b, npm test, smoke all green)
2026-11-23T03:48:29Z EXPLORE math: 2 new items, agent exit 0
2026-11-23T03:48:39Z START qa-107 on qa/qa-107-unknown-latex-commands-pass-math-validat: Unknown LaTeX commands pass math validation and can be inserted
2026-11-23T03:51:47Z DONE qa-107 (tsc -b, npm test, smoke all green)
2026-11-23T03:52:17Z START qa-108 on qa/qa-108-dismissing-a-math-edit-dialog-with-cance: Dismissing a math edit dialog with Cancel/Escape drops editor focus; typing and Backspace are swallowed
2026-11-23T03:55:19Z DONE qa-108 (tsc -b, npm test, smoke all green)
2026-11-23T03:55:49Z PROMOTED from roadmap: qa-109 Bibliography manager
2026-11-23T03:55:49Z START qa-109 on qa/qa-109-bibliography-manager: Bibliography manager
2026-11-23T04:05:27Z DONE qa-109 (tsc -b, npm test, smoke all green)
2026-11-23T04:05:57Z PROMOTED from roadmap: qa-110 Track changes UI
2026-11-23T04:05:57Z START qa-110 on qa/qa-110-track-changes-ui: Track changes UI
2026-11-23T04:17:57Z DONE qa-110 (tsc -b, npm test, smoke all green)
2026-11-23T04:28:33Z EXPLORE links-cites-footnotes: 1 new items, agent exit 0
2026-11-23T04:28:43Z START qa-111 on qa/qa-111-footnote-text-containing-a-closing-brace: Footnote text containing a closing brace is corrupted on LaTeX source round-trip
2026-11-23T04:29:56Z DONE qa-111 (tsc -b, npm test, smoke all green)
2026-11-23T04:30:26Z PROMOTED from roadmap: qa-112 Document themes and style gallery
2026-11-23T04:30:26Z START qa-112 on qa/qa-112-document-themes-and-style-gallery: Document themes and style gallery
2026-11-23T04:34:52Z DONE qa-112 (tsc -b, npm test, smoke all green)
2026-11-23T04:35:22Z PROMOTED from roadmap: qa-113 Multi-document workspace tabs
2026-11-23T04:35:22Z START qa-113 on qa/qa-113-multi-document-workspace-tabs: Multi-document workspace tabs
2026-11-23T04:47:35Z DONE qa-113 (tsc -b, npm test, smoke all green)
2026-11-23T04:48:05Z PROMOTED from roadmap: qa-114 Export to HTML and Markdown alongside LaTeX
2026-11-23T04:48:05Z START qa-114 on qa/qa-114-export-to-html-and-markdown-alongside-la: Export to HTML and Markdown alongside LaTeX
2026-11-23T04:57:18Z DONE qa-114 (tsc -b, npm test, smoke all green)
2026-11-23T04:57:38Z EXPLORE review: 0 new items, agent exit 1
2026-11-23T04:57:48Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:00:18Z START qa-115 on qa/qa-115-source-view-toggle-did-not-reveal-an-edi: source view toggle did not reveal an editable LaTeX surface
2026-11-23T05:00:45Z DONE qa-115 (tsc -b, npm test, smoke all green)
2026-11-23T05:01:15Z START qa-116 on qa/qa-116-no-view-ribbon-tab-found-cannot-check-so: no View ribbon tab found, cannot check source-view round trips
2026-11-23T05:01:41Z DONE qa-116 (tsc -b, npm test, smoke all green)
2026-11-23T05:02:11Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:04:32Z EXPLORE source-editor: 0 new items, agent exit 1
2026-11-23T05:04:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:07:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:09:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:12:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:14:32Z EXPLORE long-document: 0 new items, agent exit 1
2026-11-23T05:14:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:17:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:19:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:22:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:24:32Z EXPLORE persistence: 0 new items, agent exit 1
2026-11-23T05:24:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:27:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:29:42Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:32:12Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:34:33Z EXPLORE keyboard: 0 new items, agent exit 1
2026-11-23T05:34:43Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:37:13Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:39:43Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:42:13Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:44:33Z EXPLORE insert-media: 0 new items, agent exit 1
2026-11-23T05:44:43Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:47:13Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:49:43Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:52:13Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:54:34Z EXPLORE lists: 0 new items, agent exit 1
2026-11-23T05:54:44Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:57:14Z BACKLOG EMPTY — nothing open, idle
2026-11-23T05:59:44Z BACKLOG EMPTY — nothing open, idle
2026-11-23T06:02:14Z BACKLOG EMPTY — nothing open, idle
2026-11-23T06:04:34Z EXPLORE tables: 0 new items, agent exit 1
2026-11-23T06:04:44Z BACKLOG EMPTY — nothing open, idle
2026-11-23T06:07:14Z BACKLOG EMPTY — nothing open, idle
2026-11-23T06:09:44Z BACKLOG EMPTY — nothing open, idle
2026-11-23T12:47:57Z EXPLORE math: 0 new items, agent exit 1
2026-11-23T12:48:14Z BACKLOG EMPTY — nothing open, idle
2026-11-23T13:01:03Z EXPLORE links-cites-footnotes: 0 new items, agent exit 143
2026-11-23T13:01:05Z SMOKE RED — queueing the failure as critical work: FAIL failures=1 observations=0 consoleErrors=0
  FAIL harness: Error: page.waitForTimeout: Target page, context or browser has been closed
2026-11-23T13:15:47Z EXPLORE review: 5 new items, agent exit 0
2026-11-23T13:16:01Z START qa-118 on qa/qa-118-rejecting-a-tracked-edit-made-after-a-co: Rejecting a tracked edit made after a comment removes the comment highlight and leaves the thread unanchored
2026-11-23T13:29:59Z DONE qa-118 (tsc -b, npm test, smoke all green)
2026-11-23T13:30:33Z START qa-119 on qa/qa-119-adding-a-comment-to-a-selection-that-ove: Adding a comment to a selection that overlaps an existing comment silently removes the first comment's highlight
2026-11-23T13:36:42Z DONE qa-119 (tsc -b, npm test, smoke all green)
2026-11-23T13:37:16Z START qa-120 on qa/qa-120-applying-an-edited-latex-source-drops-ev: Applying an edited LaTeX source drops every comment highlight and leaves comment threads unanchored
2026-11-23T13:44:17Z DONE qa-120 (tsc -b, npm test, smoke all green)
2026-11-23T20:54:28Z START qa-123 on qa/qa-123-leaving-the-latex-view-after-a-failed-ap: Leaving the LaTeX view after a failed Apply silently discards the broken source draft
2026-11-23T20:58:27Z DONE qa-123 (tsc -b, npm test, smoke all green)
2026-11-23T20:59:02Z START qa-124 on qa/qa-124-headings-and-tables-placed-directly-afte: Headings and tables placed directly after text are escaped into literal text instead of being recognized
2026-11-23T21:01:28Z DONE qa-124 (tsc -b, npm test, smoke all green)
2026-11-23T21:02:03Z START qa-125 on qa/qa-125-missing-closing-braces-are-accepted-as-v: Missing closing braces are accepted as valid LaTeX and the malformed text is rewritten on export
2026-11-23T21:05:19Z DONE qa-125 (tsc -b, npm test, smoke all green)
2026-11-23T21:05:54Z START qa-122 on qa/qa-122-new-comment-with-no-selection-accepts-a: New comment with no selection accepts a comment body and then discards it
2026-11-23T21:08:21Z DONE qa-122 (tsc -b, npm test, smoke all green)
2026-11-23T21:32:42Z EXPLORE source-editor: 5 new items, agent exit 0
2026-11-24T16:52:46Z START qa-128 on qa/qa-128-clicking-apply-source-drops-keyboard-foc: Clicking Apply source drops keyboard focus, so subsequent typing and redo are silently ignored
2026-11-24T16:56:47Z DONE qa-128 (tsc -b, npm test, smoke all green)
2026-11-24T16:57:30Z START qa-129 on qa/qa-129-latex-comments-in-the-document-body-beco: LaTeX comments in the document body become visible text and are escaped on export
2026-11-24T17:00:16Z DONE qa-129 (tsc -b, npm test, smoke all green)
2026-11-24T17:00:59Z START qa-130 on qa/qa-130-unclosed-math-delimiters-are-accepted-as: Unclosed math delimiters are accepted as valid and escaped instead of reported
2026-11-24T17:08:28Z DONE qa-130 (tsc -b, npm test, smoke all green)
2026-11-24T17:09:02Z START qa-132 on qa/qa-132-page-divider-lines-are-painted-through-t: Page divider lines are painted through text lines and headings
2026-11-24T17:24:52Z DONE qa-132 (tsc -b, npm test, smoke all green)
2026-11-24T17:40:05Z EXPLORE persistence: 1 new items, agent exit 0
2026-11-24T17:40:20Z START qa-134 on qa/qa-134-visual-edits-are-never-saved-while-an-in: Visual edits are never saved while an invalid LaTeX draft is left in the hidden source pane, and are lost on reload
2026-11-24T17:44:45Z DONE qa-134 (tsc -b, npm test, smoke all green)
2026-11-24T17:45:20Z START qa-133 on qa/qa-133-outline-entry-drops-inline-math-from-a-h: Outline entry drops inline math from a heading
2026-11-24T17:46:30Z DONE qa-133 (tsc -b, npm test, smoke all green)
2026-11-24T17:47:04Z START qa-126 on qa/qa-126-stale-retry-save-error-remains-after-the: Stale 'Retry save' error remains after the failed source draft has been discarded
2026-11-24T17:51:25Z DONE qa-126 (tsc -b, npm test, smoke all green)
2026-11-24T17:51:59Z START qa-131 on qa/qa-131-undo-history-is-discarded-after-leaving: Undo history is discarded after leaving and re-entering the LaTeX view
2026-11-24T18:08:32Z DONE qa-131 (tsc -b, npm test, smoke all green)
2026-11-24T18:18:50Z EXPLORE keyboard: 4 new items, agent exit 0
2026-11-24T18:19:05Z START qa-135 on qa/qa-135-tab-is-trapped-in-the-document-editor-an: Tab is trapped in the document editor and each press nests the paragraph in another blockquote
2026-11-24T18:23:23Z DONE qa-135 (tsc -b, npm test, smoke all green)
2026-11-24T18:23:57Z START qa-136 on qa/qa-136-ctrl-f-opens-the-find-bar-behind-an-open: Ctrl+F opens the find bar behind an open modal and moves focus out of the dialog
2026-11-24T18:25:43Z DONE qa-136 (tsc -b, npm test, smoke all green)
2026-11-24T18:26:17Z START qa-137 on qa/qa-137-arxiv-dialog-opens-with-focus-still-on-t: arXiv dialog opens with focus still on the ribbon button and loses focus to <body> when closed
2026-11-24T18:28:09Z DONE qa-137 (tsc -b, npm test, smoke all green)
2026-11-24T18:28:43Z START qa-138 on qa/qa-138-escape-does-not-close-the-text-color-pop: Escape does not close the Text color popover
2026-11-24T18:29:54Z DONE qa-138 (tsc -b, npm test, smoke all green)
2026-11-24T18:43:42Z EXPLORE insert-media: 4 new items, agent exit 0
2026-11-24T18:43:56Z START qa-139 on qa/qa-139-page-furniture-and-block-images-inserted: Page furniture and block images inserted in a table cell disappear from the exported LaTeX
2026-11-24T18:51:50Z DONE qa-139 (tsc -b, npm test, smoke all green)
2026-11-24T18:52:24Z START qa-140 on qa/qa-140-typing-after-inserting-an-image-page-bre: Typing after inserting an image, page break or table of contents replaces the just-inserted block
2026-11-24T18:54:57Z DONE qa-140 (tsc -b, npm test, smoke all green)
2026-11-24T18:55:32Z START qa-141 on qa/qa-141-applying-the-latex-source-turns-an-inser: Applying the LaTeX source turns an inserted image into a broken image
2026-11-24T19:01:26Z DONE qa-141 (tsc -b, npm test, smoke all green)
2026-11-24T19:02:00Z START qa-142 on qa/qa-142-exported-figure-captions-use-the-file-na: Exported figure captions use the file name and are invisible in the visual editor
2026-11-24T19:10:16Z DONE qa-142 (tsc -b, npm test, smoke all green)
2026-11-24T19:38:07Z EXPLORE lists: 3 new items, agent exit 0
2026-11-24T19:38:21Z START qa-143 on qa/qa-143-tab-on-the-first-item-of-a-list-moves-fo: Tab on the first item of a list moves focus out of the editor instead of nesting
2026-11-24T19:42:44Z DONE qa-143 (tsc -b, npm test, smoke all green)
2026-11-24T19:43:18Z START qa-144 on qa/qa-144-a-list-followed-by-paragraph-text-withou: A list followed by paragraph text without a blank line is imported as escaped literal text
2026-11-24T19:45:13Z DONE qa-144 (tsc -b, npm test, smoke all green)
2026-11-24T19:45:47Z START qa-145 on qa/qa-145-ctrl-a-then-the-list-button-does-not-con: Ctrl+A then the list button does not convert a list to paragraphs; it appends an empty item
2026-11-24T19:49:15Z DONE qa-145 (tsc -b, npm test, smoke all green)
2026-11-24T19:49:49Z BACKLOG EMPTY — nothing open, idle
2026-11-24T20:11:04Z EXPLORE tables: 4 new items, agent exit 0
2026-11-24T20:11:19Z START qa-147 on qa/qa-147-inserting-a-table-inside-a-table-silentl: Inserting a table inside a table silently flattens the nested table's cells into the parent cell
2026-11-24T20:13:14Z DONE qa-147 (tsc -b, npm test, smoke all green)
2026-11-24T20:13:48Z START qa-148 on qa/qa-148-turning-the-header-row-off-is-not-export: Turning the header row off is not exported and is silently re-enabled by a source round trip
2026-11-24T20:15:29Z DONE qa-148 (tsc -b, npm test, smoke all green)
2026-11-24T20:16:03Z START qa-149 on qa/qa-149-add-row-above-the-header-row-moves-the-h: Add row above the header row moves the header into row 2 and the toolbar then reports no header row
2026-11-24T20:20:51Z DONE qa-149 (tsc -b, npm test, smoke all green)
2026-11-24T20:21:25Z START qa-146 on qa/qa-146-keyboard-shortcut-tab-indent-has-no-visi: keyboard shortcut "Tab indent" has no visible effect on the document
2026-11-24T20:24:34Z DONE qa-146 (tsc -b, npm test, smoke all green)
2026-11-24T20:31:28Z EXPLORE math: 0 new items, agent exit 1
2026-11-24T20:31:43Z START qa-150 on qa/qa-150-delete-row-and-delete-column-stay-enable: Delete row and Delete column stay enabled at one row/column and silently do nothing
2026-11-24T20:33:36Z DONE qa-150 (tsc -b, npm test, smoke all green)
2026-11-24T20:34:10Z BACKLOG EMPTY — nothing open, idle
2026-11-24T20:36:45Z BACKLOG EMPTY — nothing open, idle
2026-11-24T20:39:19Z BACKLOG EMPTY — nothing open, idle
2026-11-24T21:01:52Z EXPLORE links-cites-footnotes: 5 new items, agent exit 0
2026-11-24T21:02:06Z START qa-151 on qa/qa-151-footnote-text-cannot-be-edited-in-the-vi: Footnote text cannot be edited in the visual editor; typing over the marker deletes the note
2026-11-24T21:05:51Z PUSHED main
2026-11-24T21:05:51Z DONE qa-151 (tsc -b, npm test, smoke all green)
2026-11-24T21:06:25Z START qa-152 on qa/qa-152-inserting-a-citation-footnote-or-cross-r: Inserting a citation, footnote or cross-reference after a LaTeX round-trip puts it inside the title heading
2026-11-24T21:12:52Z PUSHED main
2026-11-24T21:12:52Z DONE qa-152 (tsc -b, npm test, smoke all green)
2026-11-24T21:13:26Z START qa-153 on qa/qa-153-no-way-to-remove-a-hyperlink-clearing-th: No way to remove a hyperlink: clearing the address disables Insert and Escape keeps the link
2026-11-24T21:15:01Z PUSHED main
2026-11-24T21:15:01Z DONE qa-153 (tsc -b, npm test, smoke all green)
2026-11-24T21:15:35Z START qa-154 on qa/qa-154-bibtex-keys-and-cross-reference-labels-a: BibTeX keys and cross-reference labels are written to LaTeX unescaped, so `}` breaks the command
2026-11-24T21:18:13Z PUSHED main
2026-11-24T21:18:13Z DONE qa-154 (tsc -b, npm test, smoke all green)
2026-11-24T21:33:28Z EXPLORE review: 5 new items, agent exit 0
2026-11-24T21:33:42Z START qa-157 on qa/qa-157-turning-tracking-off-within-the-revision: Turning tracking off within the revision debounce silently discards the edit that was made while tracking was on
2026-11-24T21:37:03Z PUSHED main
2026-11-24T21:37:03Z DONE qa-157 (tsc -b, npm test, smoke all green)
2026-11-24T21:37:37Z START qa-158 on qa/qa-158-rejecting-a-tracked-insertion-of-a-new-p: Rejecting a tracked insertion of a new paragraph leaves an empty paragraph behind
2026-11-24T21:42:11Z PUSHED main
2026-11-24T21:42:11Z DONE qa-158 (tsc -b, npm test, smoke all green)
2026-11-24T21:42:46Z RECOVERED qa-121 (in_progress for 1917 min)
2026-11-24T21:42:46Z RECOVERED qa-127 (in_progress for 1449 min)
2026-11-24T21:42:46Z START qa-127 on qa/qa-127-split-view-silently-discards-visual-pane: Split view silently discards visual-pane edits when the source pane has an unapplied draft
2026-11-24T21:50:52Z PUSHED main
2026-11-24T21:50:52Z DONE qa-127 (tsc -b, npm test, smoke all green)
2026-11-24T21:51:27Z START qa-121 on qa/qa-121-tracked-change-decorations-misreport-exi: Tracked-change decorations misreport existing text as deleted and re-inserted when the paragraph contains a comment mark
2026-11-24T21:58:33Z PUSHED main
2026-11-24T21:58:33Z DONE qa-121 (tsc -b, npm test, smoke all green)
2026-11-24T22:20:53Z EXPLORE source-editor: 8 new items, agent exit 0
2026-11-24T22:21:07Z START qa-162 on qa/qa-162-a-section-with-a-label-on-the-same-line: A section with a label on the same line gets its heading corrupted and loses the label
2026-11-24T22:24:23Z PUSHED main
2026-11-24T22:24:23Z DONE qa-162 (tsc -b, npm test, smoke all green)
2026-11-24T22:24:57Z START qa-159 on qa/qa-159-applying-an-edited-latex-source-drops-th: Applying an edited LaTeX source drops the highlight of a comment that spans two paragraphs even when both paragraphs sti
2026-11-24T22:28:37Z PUSHED main
2026-11-24T22:28:37Z DONE qa-159 (tsc -b, npm test, smoke all green)
2026-11-24T22:29:11Z START qa-160 on qa/qa-160-tracked-change-decorations-mark-unchange: Tracked-change decorations mark unchanged trailing text as both deleted and re-inserted when the paragraph contains a co
2026-11-24T22:34:34Z PUSHED main
2026-11-24T22:34:34Z DONE qa-160 (tsc -b, npm test, smoke all green)
2026-11-24T22:35:08Z START qa-163 on qa/qa-163-display-math-written-with-or-a-one-line: Display math written with \[...\], $$...$$ or a one-line equation environment is imported as literal text and escaped
2026-11-24T22:36:56Z PUSHED main
2026-11-24T22:36:56Z DONE qa-163 (tsc -b, npm test, smoke all green)
2026-11-24T23:00:13Z EXPLORE long-document: 2 new items, agent exit 0
2026-11-24T23:00:27Z START qa-170 on qa/qa-170-a-heading-at-a-page-boundary-is-pushed-t: A heading at a page boundary is pushed to the bottom of a nearly blank page
2026-11-24T23:06:10Z PUSHED main
2026-11-24T23:06:10Z DONE qa-170 (tsc -b, npm test, smoke all green)
2026-11-24T23:06:44Z START qa-164 on qa/qa-164-a-hand-written-booktabs-table-turns-topr: A hand-written booktabs table turns \toprule/\midrule/\bottomrule into cells and an extra row
2026-11-24T23:08:29Z PUSHED main
2026-11-24T23:08:29Z DONE qa-164 (tsc -b, npm test, smoke all green)
2026-11-24T23:09:03Z START qa-165 on qa/qa-165-starred-section-section-is-shown-as-lite: Starred section \section*{...} is shown as literal text and escaped on export
2026-11-24T23:11:23Z PUSHED main
2026-11-24T23:11:23Z DONE qa-165 (tsc -b, npm test, smoke all green)
2026-11-24T23:11:57Z START qa-166 on qa/qa-166-emph-is-not-recognised-italics-are-show: \emph{...} is not recognised: italics are shown as the raw command and escaped on export
2026-11-24T23:13:03Z PUSHED main
2026-11-24T23:13:03Z DONE qa-166 (tsc -b, npm test, smoke all green)
2026-11-24T23:23:48Z EXPLORE persistence: 2 new items, agent exit 0
2026-11-24T23:24:02Z START qa-172 on qa/qa-172-a-failed-localstorage-write-for-the-rece: A failed localStorage write for the recent-projects list unmounts the whole app to a blank page
2026-11-24T23:26:55Z PUSHED main
2026-11-24T23:26:55Z DONE qa-172 (tsc -b, npm test, smoke all green)
2026-11-24T23:27:29Z START qa-167 on qa/qa-167-table-rows-ending-with-4pt-make-the-enti: Table rows ending with \\[4pt] make the entire table fall back to escaped literal text
2026-11-24T23:29:04Z PUSHED main
2026-11-24T23:29:04Z DONE qa-167 (tsc -b, npm test, smoke all green)
2026-11-24T23:29:38Z START qa-171 on qa/qa-171-outline-click-on-a-page-snapped-heading: Outline click on a page-snapped heading scrolls to blank space instead of the heading
2026-11-24T23:36:59Z PUSHED main
2026-11-24T23:36:59Z DONE qa-171 (tsc -b, npm test, smoke all green)
2026-11-24T23:37:33Z START qa-173 on qa/qa-173-an-unapplied-unparsable-latex-draft-is-d: An unapplied, unparsable LaTeX draft is discarded on navigation away or reload with no warning
2026-11-25T00:04:09Z PUSHED main
2026-11-25T00:04:09Z DONE qa-173 (tsc -b, npm test, smoke all green)
2026-11-25T00:13:55Z EXPLORE keyboard: 4 new items, agent exit 0
2026-11-25T00:14:09Z START qa-174 on qa/qa-174-tab-in-the-document-wraps-the-paragraph: Tab in the document wraps the paragraph in a block quote instead of moving focus
2026-11-25T00:16:35Z PUSHED main
2026-11-25T00:16:35Z DONE qa-174 (tsc -b, npm test, smoke all green)
2026-11-25T00:17:10Z START qa-175 on qa/qa-175-tab-never-leaves-a-table-and-appends-a-r: Tab never leaves a table and appends a row at the end
2026-11-25T00:21:05Z PUSHED main
2026-11-25T00:21:05Z DONE qa-175 (tsc -b, npm test, smoke all green)
2026-11-25T00:21:40Z START qa-155 on qa/qa-155-a-citation-key-missing-from-the-bibliogr: A citation key missing from the bibliography is inserted with no warning
2026-11-25T00:25:06Z PUSHED main
2026-11-25T00:25:06Z DONE qa-155 (tsc -b, npm test, smoke all green)
2026-11-25T00:25:41Z START qa-161 on qa/qa-161-deleting-the-text-a-comment-is-attached: Deleting the text a comment is attached to leaves the thread listed with no highlight and no way to locate it
2026-11-25T00:28:10Z PUSHED main
2026-11-25T00:28:10Z DONE qa-161 (tsc -b, npm test, smoke all green)
2026-11-25T00:52:10Z EXPLORE insert-media: 3 new items, agent exit 0
2026-11-25T00:52:24Z START qa-178 on qa/qa-178-every-inserted-image-exports-at-80-of-th: Every inserted image exports at 80% of the line width regardless of its natural size, so the PDF does not match the page
2026-11-25T01:00:21Z PUSH FAILED: 1-25T01:00:21Z
To https://github.com/kalandor122/sentence.git
 ! [remote rejected] main -> main (Internal Server Error)
error: failed to push some refs to 'https://github.com/kalandor122/sentence.git'
2026-11-25T01:00:21Z DONE qa-178 (tsc -b, npm test, smoke all green)
2026-11-25T01:00:55Z START qa-179 on qa/qa-179-two-different-images-with-the-same-file: Two different images with the same file name share one asset path and become the same picture after Apply source
2026-11-25T01:04:26Z PUSHED main
2026-11-25T01:04:26Z DONE qa-179 (tsc -b, npm test, smoke all green)
2026-11-25T01:05:00Z START qa-168 on qa/qa-168-a-table-s-last-row-without-a-trailing-sw: A table's last row without a trailing \\ swallows the following \hline into a cell
2026-11-25T01:08:35Z PUSHED main
2026-11-25T01:08:35Z DONE qa-168 (tsc -b, npm test, smoke all green)
2026-11-25T01:09:09Z START qa-169 on qa/qa-169-undoing-every-source-edit-leaves-apply-s: Undoing every source edit leaves Apply source enabled and reports a synchronisation that changed nothing
2026-11-25T01:13:02Z PUSHED main
2026-11-25T01:13:02Z DONE qa-169 (tsc -b, npm test, smoke all green)
2026-11-25T01:44:37Z EXPLORE lists: 3 new items, agent exit 0
2026-11-25T01:44:51Z START qa-181 on qa/qa-181-ctrl-a-then-switching-list-type-wraps-th: Ctrl+A then switching list type wraps the whole document and nests the existing list
2026-11-25T01:48:43Z PUSHED main
2026-11-25T01:48:43Z DONE qa-181 (tsc -b, npm test, smoke all green)
2026-11-25T01:49:17Z START qa-182 on qa/qa-182-enter-at-the-end-of-a-parent-item-moves: Enter at the end of a parent item moves its nested sublist to the new item
2026-11-25T01:51:46Z PUSHED main
2026-11-25T01:51:46Z DONE qa-182 (tsc -b, npm test, smoke all green)
2026-11-25T01:52:21Z START qa-183 on qa/qa-183-leaving-a-numbered-list-from-the-middle: Leaving a numbered list from the middle restarts the remaining items at 1
2026-11-25T01:56:15Z PUSHED main
2026-11-25T01:56:15Z DONE qa-183 (tsc -b, npm test, smoke all green)
2026-11-25T01:56:49Z START qa-176 on qa/qa-176-text-colour-popover-uses-role-menu-but-h: Text colour popover uses role=menu but has plain-button children and no arrow-key navigation
2026-11-25T01:59:07Z PUSHED main
2026-11-25T01:59:07Z DONE qa-176 (tsc -b, npm test, smoke all green)
2026-11-25T02:19:42Z EXPLORE tables: 2 new items, agent exit 0
2026-11-25T02:19:56Z START qa-184 on qa/qa-184-deleting-the-last-row-or-last-column-eje: Deleting the last row or last column ejects the caret from the table, hides the table toolbar, and sends subsequent typi
2026-11-25T02:23:45Z PUSHED main
2026-11-25T02:23:45Z DONE qa-184 (tsc -b, npm test, smoke all green)
2026-11-25T02:24:19Z START qa-177 on qa/qa-177-document-editor-is-exposed-as-role-textb: Document editor is exposed as role=textbox without aria-multiline
2026-11-25T02:25:16Z PUSHED main
2026-11-25T02:25:16Z DONE qa-177 (tsc -b, npm test, smoke all green)
2026-11-25T02:25:50Z START qa-180 on qa/qa-180-block-images-lose-their-alt-text-when-th: Block images lose their alt text when the document is synchronized from LaTeX
2026-11-25T02:27:41Z PUSHED main
2026-11-25T02:27:41Z DONE qa-180 (tsc -b, npm test, smoke all green)
2026-11-25T02:28:15Z START qa-185 on qa/qa-185-a-table-caption-typed-in-the-table-toolb: A table caption typed in the Table toolbar is exported to LaTeX but never shown in the visual document
2026-11-25T02:33:05Z PUSHED main
2026-11-25T02:33:05Z DONE qa-185 (tsc -b, npm test, smoke all green)
2026-11-25T02:50:02Z EXPLORE math: 3 new items, agent exit 0
2026-11-25T02:50:16Z START qa-186 on qa/qa-186-display-equation-inside-a-table-cell-is: Display equation inside a table cell is silently dropped from the LaTeX export
2026-11-25T02:53:27Z PUSHED main
2026-11-25T02:53:27Z DONE qa-186 (tsc -b, npm test, smoke all green)
2026-11-25T02:54:01Z START qa-187 on qa/qa-187-blank-line-inside-inline-math-is-accepte: Blank line inside inline math is accepted, exported as invalid LaTeX, then silently converted to text on Apply source
2026-11-25T02:55:37Z PUSHED main
2026-11-25T02:55:37Z DONE qa-187 (tsc -b, npm test, smoke all green)
2026-11-25T02:56:11Z START qa-188 on qa/qa-188-display-equations-inside-blockquotes-or: Display equations inside blockquotes or list items are imported as literal text and escaped on export
2026-11-25T02:58:06Z PUSHED main
2026-11-25T02:58:06Z DONE qa-188 (tsc -b, npm test, smoke all green)
2026-11-25T02:58:41Z PROMOTED from roadmap: qa-189 Two-column documents: settings, preamble and round trip
2026-11-25T02:58:41Z START qa-189 on qa/qa-189-two-column-documents-settings-preamble-a: Two-column documents: settings, preamble and round trip
2026-11-25T03:00:40Z PUSHED main
2026-11-25T03:00:40Z DONE qa-189 (tsc -b, npm test, smoke all green)
2026-11-25T03:20:35Z EXPLORE links-cites-footnotes: 4 new items, agent exit 0
2026-11-25T03:20:53Z START qa-190 on qa/qa-190-multi-key-citations-are-merged-into-one: Multi-key citations are merged into one invalid key by the LaTeX round trip
2026-11-25T03:24:39Z PUSHED main
2026-11-25T03:24:39Z DONE qa-190 (tsc -b, npm test, smoke all green)
2026-11-25T03:25:17Z START qa-191 on qa/qa-191-typing-after-applying-or-removing-a-hype: Typing after applying or removing a hyperlink replaces the link text
2026-11-25T03:28:05Z PUSHED main
2026-11-25T03:28:05Z DONE qa-191 (tsc -b, npm test, smoke all green)
2026-11-25T03:28:44Z START qa-192 on qa/qa-192-clicking-a-footnote-marker-and-typing-de: Clicking a footnote marker and typing deletes the footnote
2026-11-25T03:31:14Z PUSHED main
2026-11-25T03:31:14Z DONE qa-192 (tsc -b, npm test, smoke all green)
2026-11-25T03:31:52Z START qa-193 on qa/qa-193-after-updating-a-footnote-the-caret-is-p: After updating a footnote the caret is placed before the marker
2026-11-25T03:33:56Z PUSHED main
2026-11-25T03:33:56Z DONE qa-193 (tsc -b, npm test, smoke all green)
2026-11-25T04:05:15Z EXPLORE review: 5 new items, agent exit 0
2026-11-25T04:05:33Z START qa-194 on qa/qa-194-tracked-change-decorations-are-drawn-in: Tracked-change decorations are drawn in the wrong paragraph when an identical line appears earlier
2026-11-25T04:08:07Z PUSHED main
2026-11-25T04:08:07Z DONE qa-194 (tsc -b, npm test, smoke all green)
2026-11-25T04:08:45Z START qa-195 on qa/qa-195-edits-applied-from-the-latex-source-pane: Edits applied from the LaTeX source pane while tracking is on are never recorded as revisions
2026-11-25T04:22:36Z PUSHED main
2026-11-25T04:22:36Z DONE qa-195 (tsc -b, npm test, smoke all green)
2026-11-25T04:23:14Z START qa-196 on qa/qa-196-undoing-a-comment-addition-leaves-an-orp: Undoing a comment addition leaves an orphaned thread with a false 'text was deleted' note
2026-11-25T04:29:07Z PUSHED main
2026-11-25T04:29:07Z DONE qa-196 (tsc -b, npm test, smoke all green)
2026-11-25T04:29:45Z START qa-197 on qa/qa-197-a-paragraph-break-only-tracked-change-pr: A paragraph-break-only tracked change produces a History card with identical before/after text and no inline decoration
2026-11-25T04:35:38Z PUSHED main
2026-11-25T04:35:38Z DONE qa-197 (tsc -b, npm test, smoke all green)
2026-11-25T05:03:57Z EXPLORE source-editor: 9 new items, agent exit 0
2026-11-25T05:04:15Z START qa-199 on qa/qa-199-a-commented-out-end-document-silently-tr: A commented-out \end{document} silently truncates the rest of the document
2026-11-25T05:06:12Z PUSHED main
2026-11-25T05:06:12Z DONE qa-199 (tsc -b, npm test, smoke all green)
2026-11-25T05:06:50Z START qa-200 on qa/qa-200-undo-after-apply-also-removes-the-text-t: Undo after Apply also removes the text that was just applied, and re-applying deletes it from the page
2026-11-25T05:16:40Z PUSHED main
2026-11-25T05:16:40Z DONE qa-200 (tsc -b, npm test, smoke all green)
2026-11-25T05:26:30Z PUSHED main
2026-11-25T05:26:30Z DONE qa-201 (tsc -b, npm test, smoke all green)
2026-11-25T05:27:08Z START qa-202 on qa/qa-202-a-section-label-on-the-line-after-the-he: A section \label on the line after the heading becomes literal text and is lost
2026-11-25T05:29:06Z PUSHED main
2026-11-25T05:29:06Z DONE qa-202 (tsc -b, npm test, smoke all green)
2026-11-25T05:49:54Z EXPLORE long-document: 2 new items, agent exit 0
2026-11-25T05:50:12Z START qa-208 on qa/qa-208-page-text-and-headings-overflow-into-the: Page text and headings overflow into the top and bottom margins
2026-11-25T05:57:53Z PUSHED main
2026-11-25T05:57:53Z DONE qa-208 (tsc -b, npm test, smoke all green)
2026-11-25T05:58:31Z START qa-203 on qa/qa-203-preamble-packages-and-macros-are-reporte: Preamble packages and macros are reported synchronized but silently dropped, and their calls are escaped
2026-11-25T06:09:31Z PUSHED main
2026-11-25T06:09:31Z DONE qa-203 (tsc -b, npm test, smoke all green)
2026-11-25T06:10:09Z START qa-204 on qa/qa-204-hand-written-align-environments-are-impo: Hand-written align environments are imported as literal text and escaped
2026-11-25T06:16:31Z PUSHED main
2026-11-25T06:16:31Z DONE qa-204 (tsc -b, npm test, smoke all green)
2026-11-25T06:17:09Z START qa-205 on qa/qa-205-a-hand-written-table-label-is-silently-d: A hand-written table \label is silently dropped, leaving a dangling \ref
2026-11-25T06:20:07Z PUSHED main
2026-11-25T06:20:07Z DONE qa-205 (tsc -b, npm test, smoke all green)
2026-11-25T06:33:06Z EXPLORE persistence: 2 new items, agent exit 0
2026-11-25T06:33:24Z START qa-210 on qa/qa-210-text-typed-after-end-document-in-the-lat: Text typed after \end{document} in the LaTeX pane is silently discarded while the app reports it saved
2026-11-25T06:39:11Z PUSHED main
2026-11-25T06:39:11Z DONE qa-210 (tsc -b, npm test, smoke all green)
2026-11-25T06:39:49Z START qa-206 on qa/qa-206-multicolumn-in-a-hand-written-table-is: \multicolumn in a hand-written table is turned into a cell's literal text
2026-11-25T06:44:57Z PUSHED main
2026-11-25T06:44:57Z DONE qa-206 (tsc -b, npm test, smoke all green)
2026-11-25T06:45:35Z START qa-209 on qa/qa-209-a-paragraph-longer-than-a-page-is-cut-by: A paragraph longer than a page is cut by every page rule
2026-11-25T06:59:57Z PUSHED main
2026-11-25T06:59:57Z DONE qa-209 (tsc -b, npm test, smoke all green)
2026-11-25T07:00:35Z START qa-211 on qa/qa-211-the-save-indicator-says-saved-locally-wh: The save indicator says 'Saved locally' while the initial workspace write has failed
2026-11-25T07:05:06Z PUSHED main
2026-11-25T07:05:06Z DONE qa-211 (tsc -b, npm test, smoke all green)
2026-11-25T07:57:13Z EXPLORE keyboard: 6 new items, agent exit 0
2026-11-25T07:57:31Z START qa-212 on qa/qa-212-ctrl-alt-1-2-3-change-the-current-block: Ctrl+Alt+1/2/3 change the current block's heading level on their way to switching views
2026-11-25T08:03:09Z PUSHED main
2026-11-25T08:03:09Z DONE qa-212 (tsc -b, npm test, smoke all green)
2026-11-25T08:03:47Z START qa-213 on qa/qa-213-escape-closes-the-properties-panel-behin: Escape closes the Properties panel behind a dialog instead of the dialog in front of it, and leaves focus on the page be
2026-11-25T08:08:58Z PUSHED main
2026-11-25T08:08:58Z DONE qa-213 (tsc -b, npm test, smoke all green)
2026-11-25T08:09:36Z START qa-214 on qa/qa-214-tabbing-out-of-the-text-colour-palette-l: Tabbing out of the text-colour palette leaves it and its full-window backdrop open, and Escape no longer closes it
2026-11-25T08:13:36Z PUSHED main
2026-11-25T08:13:36Z DONE qa-214 (tsc -b, npm test, smoke all green)
2026-11-25T08:14:14Z START qa-215 on qa/qa-215-existing-equations-cannot-be-opened-from: Existing equations cannot be opened from the keyboard; Enter on the selected math node does nothing
2026-11-25T08:24:13Z PUSHED main
2026-11-25T08:24:13Z DONE qa-215 (tsc -b, npm test, smoke all green)
2026-11-25T09:17:56Z EXPLORE insert-media: 6 new items, agent exit 0
2026-11-25T09:18:14Z START qa-218 on qa/qa-218-inserting-a-table-of-contents-or-a-page: Inserting a table of contents or a page break with the caret inside a heading splits the heading into two headings
2026-11-25T09:20:40Z PUSHED main
2026-11-25T09:20:40Z DONE qa-218 (tsc -b, npm test, smoke all green)
2026-11-25T09:21:18Z START qa-219 on qa/qa-219-a-tall-image-is-rendered-at-full-natural: A tall image is rendered at full natural height across several pages while the exported PDF scales it to fit one page
2026-11-25T09:33:14Z PUSHED main
2026-11-25T09:33:14Z DONE qa-219 (tsc -b, npm test, smoke all green)
2026-11-25T09:33:52Z START qa-220 on qa/qa-220-the-toc-preview-shows-the-full-heading-t: The TOC preview shows the full heading text for \section[Short]{Long} instead of the short title the PDF contents will p
2026-11-25T09:40:36Z PUSHED main
2026-11-25T09:40:36Z DONE qa-220 (tsc -b, npm test, smoke all green)
2026-11-25T09:41:13Z START qa-221 on qa/qa-221-the-toc-preview-numbers-a-starred-unnumb: The TOC preview numbers a starred (unnumbered) heading and shifts the numbering of later headings
2026-11-25T09:45:06Z PUSHED main
2026-11-25T09:45:06Z DONE qa-221 (tsc -b, npm test, smoke all green)
2026-11-25T10:17:34Z EXPLORE lists: 5 new items, agent exit 0
2026-11-25T10:17:52Z START qa-222 on qa/qa-222-the-toc-preview-lists-a-heading-that-the: The TOC preview lists a heading that the exporter turns into \maketitle and removes from the body
2026-11-25T10:26:29Z PUSHED main
2026-11-25T10:26:29Z DONE qa-222 (tsc -b, npm test, smoke all green)
2026-11-25T10:27:07Z START qa-223 on qa/qa-223-the-properties-generate-table-of-content: The Properties 'Generate table of contents' switch adds a contents page the visual editor never shows; adding a ribbon T
2026-11-25T10:46:18Z PUSHED main
2026-11-25T10:46:18Z DONE qa-223 (tsc -b, npm test, smoke all green)
2026-11-25T10:46:56Z START qa-224 on qa/qa-224-turning-numbering-off-for-one-item-in-a: Turning numbering off for one item in a numbered list restarts the remaining items at 1
2026-11-25T10:51:23Z PUSHED main
2026-11-25T10:51:23Z DONE qa-224 (tsc -b, npm test, smoke all green)
2026-11-25T10:52:01Z START qa-225 on qa/qa-225-clicking-the-highlighted-list-button-ins: Clicking the highlighted list button inside a nested item only outdents it and keeps the bullet
2026-11-25T10:56:59Z PUSHED main
2026-11-25T10:56:59Z DONE qa-225 (tsc -b, npm test, smoke all green)
2026-11-25T11:06:28Z EXPLORE tables: 3 new items, agent exit 0
2026-11-25T11:06:46Z START qa-226 on qa/qa-226-enter-on-an-empty-item-in-the-middle-of: Enter on an empty item in the middle of a nested list turns the new text into part of the parent item
2026-11-25T11:11:39Z PUSHED main
2026-11-25T11:11:39Z DONE qa-226 (tsc -b, npm test, smoke all green)
2026-11-25T11:12:17Z START qa-229 on qa/qa-229-a-table-caption-containing-a-closing-bra: A table caption containing a closing brace is silently corrupted by a LaTeX source round trip
2026-11-25T11:14:18Z PUSHED main
2026-11-25T11:14:18Z DONE qa-229 (tsc -b, npm test, smoke all green)
2026-11-25T11:14:57Z START qa-230 on qa/qa-230-tab-in-the-last-table-cell-jumps-to-the: Tab in the last table cell jumps to the 'Visual' view button and the next keystrokes are discarded
2026-11-25T11:20:30Z PUSHED main
2026-11-25T11:20:30Z DONE qa-230 (tsc -b, npm test, smoke all green)
2026-11-25T11:21:08Z START qa-198 on qa/qa-198-history-card-preview-clips-to-the-last-1: History card preview clips to the last 180 characters, so edits near the start of a long document show identical before/
2026-11-25T11:23:17Z PUSHED main
2026-11-25T11:23:17Z DONE qa-198 (tsc -b, npm test, smoke all green)
2026-11-25T11:54:38Z EXPLORE math: 4 new items, agent exit 0
2026-11-25T11:54:56Z START qa-232 on qa/qa-232-an-equation-carrying-its-label-renders-t: An equation carrying its \label renders the label as red error text and can no longer be edited
2026-11-25T11:56:58Z PUSHED main
2026-11-25T11:56:58Z DONE qa-232 (tsc -b, npm test, smoke all green)
2026-11-25T11:57:36Z START qa-233 on qa/qa-233-a-blank-line-inside-a-display-equation-i: A blank line inside a display equation is accepted from the source and re-exported as uncompilable LaTeX
2026-11-25T11:59:51Z PUSHED main
2026-11-25T11:59:51Z DONE qa-233 (tsc -b, npm test, smoke all green)
2026-11-25T12:00:29Z START qa-234 on qa/qa-234-invalid-blank-line-math-disables-insert: Invalid blank-line math disables Insert with no visible error message
2026-11-25T12:02:25Z PUSHED main
2026-11-25T12:02:25Z DONE qa-234 (tsc -b, npm test, smoke all green)
2026-11-25T12:03:03Z START qa-235 on qa/qa-235-inside-a-paragraph-is-silently-converte: $$...$$ inside a paragraph is silently converted into literal dollar text
2026-11-25T12:05:01Z PUSHED main
2026-11-25T12:05:01Z DONE qa-235 (tsc -b, npm test, smoke all green)
2026-11-25T12:36:22Z EXPLORE links-cites-footnotes: 3 new items, agent exit 0
2026-11-25T12:36:40Z START qa-236 on qa/qa-236-clicking-a-citation-or-cross-reference-a: Clicking a citation or cross-reference and typing deletes it
2026-11-25T12:38:48Z PUSHED main
2026-11-25T12:38:48Z DONE qa-236 (tsc -b, npm test, smoke all green)
2026-11-25T12:39:26Z START qa-237 on qa/qa-237-undo-after-adding-a-hyperlink-leaves-a-p: Undo after adding a hyperlink leaves a placeholder https:// link
2026-11-25T12:51:41Z PUSHED main
2026-11-25T12:51:41Z DONE qa-237 (tsc -b, npm test, smoke all green)
2026-11-25T12:52:19Z START qa-207 on qa/qa-207-a-non-breaking-space-written-as-is-re-ex: A non-breaking space written as ~ is re-exported as a literal tilde
2026-11-25T12:55:18Z PUSHED main
2026-11-25T12:55:18Z DONE qa-207 (tsc -b, npm test, smoke all green)
2026-11-25T12:55:56Z START qa-216 on qa/qa-216-the-writing-surface-is-34-tab-presses-fr: The writing surface is 34 Tab presses from the top of the page, with no skip link or focus shortcut
2026-11-25T13:00:00Z PUSHED main
2026-11-25T13:00:00Z DONE qa-216 (tsc -b, npm test, smoke all green)
2026-11-25T13:25:01Z EXPLORE review: 4 new items, agent exit 0
2026-11-25T13:25:19Z START qa-239 on qa/qa-239-splitting-a-paragraph-with-track-changes: Splitting a paragraph with Track changes on marks unchanged blocks as inserted and deleted
2026-11-25T13:30:10Z PUSHED main
2026-11-25T13:30:10Z DONE qa-239 (tsc -b, npm test, smoke all green)
2026-11-25T13:30:48Z START qa-240 on qa/qa-240-deleting-all-text-of-a-paragraph-leaves: Deleting all text of a paragraph leaves no inline tracked-deletion marker
2026-11-25T13:33:44Z PUSHED main
2026-11-25T13:33:44Z DONE qa-240 (tsc -b, npm test, smoke all green)
2026-11-25T13:34:22Z START qa-241 on qa/qa-241-tracked-change-card-clips-its-preview-so: Tracked-change card clips its preview so the changed words are invisible
2026-11-25T13:38:21Z PUSHED main
2026-11-25T13:38:21Z DONE qa-241 (tsc -b, npm test, smoke all green)
2026-11-25T13:38:59Z START qa-217 on qa/qa-217-dialog-text-fields-drop-the-2px-focus-ou: Dialog text fields drop the 2px focus outline and show only a 1px border-colour change
2026-11-25T13:40:33Z PUSHED main
2026-11-25T13:40:33Z DONE qa-217 (tsc -b, npm test, smoke all green)
2026-11-25T14:01:46Z EXPLORE source-editor: 5 new items, agent exit 0
2026-11-25T14:02:04Z START qa-243 on qa/qa-243-a-braced-table-column-spec-p-4cm-corrupt: A braced table column spec (p{4cm}, @{}) corrupts the first cell and is rewritten
2026-11-25T14:05:01Z PUSHED main
2026-11-25T14:05:01Z DONE qa-243 (tsc -b, npm test, smoke all green)
2026-11-25T14:05:39Z START qa-244 on qa/qa-244-verbatim-code-is-latex-escaped-on-re-exp: Verbatim code is LaTeX-escaped on re-export, changing the code
2026-11-25T14:07:30Z PUSHED main
2026-11-25T14:07:30Z DONE qa-244 (tsc -b, npm test, smoke all green)
2026-11-25T14:08:08Z START qa-245 on qa/qa-245-valid-latex-environments-outside-the-sup: Valid LaTeX environments outside the supported subset are shown literally and then escaped
2026-11-25T14:12:52Z PUSHED main
2026-11-25T14:12:52Z DONE qa-245 (tsc -b, npm test, smoke all green)
2026-11-25T14:13:30Z START qa-227 on qa/qa-227-both-bulleted-and-numbered-list-buttons: Both Bulleted and Numbered list buttons show as active in a mixed nested list
2026-11-25T14:15:34Z PUSHED main
2026-11-25T14:15:34Z DONE qa-227 (tsc -b, npm test, smoke all green)
2026-11-25T14:29:06Z EXPLORE long-document: 4 new items, agent exit 0
2026-11-25T14:29:24Z START qa-248 on qa/qa-248-lists-and-blockquotes-are-never-paginate: Lists and blockquotes are never paginated: page rules cut through their lines and text sits in the margins
2026-11-25T14:37:10Z PUSHED main
2026-11-25T14:37:10Z DONE qa-248 (tsc -b, npm test, smoke all green)
2026-11-25T14:37:48Z START qa-249 on qa/qa-249-a-page-break-inserted-inside-a-word-perm: A page break inserted inside a word permanently splits the word and inflates the word count
2026-11-25T14:43:28Z PUSHED main
2026-11-25T14:43:28Z DONE qa-249 (tsc -b, npm test, smoke all green)
2026-11-25T14:44:06Z START qa-250 on qa/qa-250-after-pasting-a-long-document-the-view-s: After pasting a long document the view stops short of the caret at the end, and Ctrl+End does not scroll it into view
2026-11-25T14:53:40Z PUSHED main
2026-11-25T14:53:40Z DONE qa-250 (tsc -b, npm test, smoke all green)
2026-11-25T14:54:19Z START qa-228 on qa/qa-228-every-level-of-a-nested-numbered-list-is: Every level of a nested numbered list is labelled 1. in the visual editor
2026-11-25T14:57:52Z PUSHED main
2026-11-25T14:57:52Z DONE qa-228 (tsc -b, npm test, smoke all green)
2026-11-25T15:14:48Z EXPLORE persistence: 1 new items, agent exit 0
2026-11-25T15:15:06Z START qa-252 on qa/qa-252-a-tracked-edit-saved-just-before-a-reloa: A tracked edit saved just before a reload loses its tracked revision
2026-11-25T15:19:54Z PUSHED main
2026-11-25T15:19:54Z DONE qa-252 (tsc -b, npm test, smoke all green)
2026-11-25T15:20:32Z START qa-231 on qa/qa-231-add-row-above-in-the-header-row-inserts: 'Add row above' in the header row inserts the new row below the header instead
2026-11-25T15:46:54Z EXPLORE keyboard: 8 new items, agent exit 0
2026-11-25T15:47:12Z START qa-253 on qa/qa-253-ctrl-alt-1-back-to-visual-leaves-focus-o: Ctrl+Alt+1 back to Visual leaves focus on <body>, so the next keystrokes are silently discarded
2026-11-25T15:50:32Z PUSH FAILED: 1-25T15:50:32Z
To https://github.com/kalandor122/sentence.git
 ! [remote rejected] main -> main (Internal Server Error)
error: failed to push some refs to 'https://github.com/kalandor122/sentence.git'
2026-11-25T15:50:32Z DONE qa-253 (tsc -b, npm test, smoke all green)
2026-11-25T15:51:10Z START qa-238 on qa/qa-238-cancelling-the-insert-dialogs-drops-the: Cancelling the insert dialogs drops the next typed characters
2026-11-25T15:54:07Z PUSHED main
2026-11-25T15:54:07Z DONE qa-238 (tsc -b, npm test, smoke all green)
2026-11-25T15:54:45Z START qa-242 on qa/qa-242-demo-document-seeds-a-comment-that-is-no: Demo document seeds a comment that is not anchored, so Review opens with a deleted-text warning
2026-11-25T15:56:53Z PUSHED main
2026-11-25T15:56:53Z DONE qa-242 (tsc -b, npm test, smoke all green)
2026-11-25T16:36:58Z EXPLORE insert-media: 4 new items, agent exit 0
2026-11-25T16:37:16Z START qa-261 on qa/qa-261-an-image-inserted-inside-a-heading-is-re: An image inserted inside a heading is re-imported as two literal paragraphs, destroying the heading and its LaTeX
2026-11-25T16:44:10Z PUSHED main
2026-11-25T16:44:10Z DONE qa-261 (tsc -b, npm test, smoke all green)
2026-11-25T16:44:49Z START qa-262 on qa/qa-262-a-text-block-tall-figure-with-a-caption: A text-block-tall figure with a caption is drawn across the page boundary and the page count drops when the caption is a
2026-11-25T16:55:28Z PUSHED main
2026-11-25T16:55:28Z DONE qa-262 (tsc -b, npm test, smoke all green)
2026-11-25T16:56:06Z START qa-263 on qa/qa-263-a-caption-typed-on-an-image-inside-a-tab: A caption typed on an image inside a table cell is silently dropped from the LaTeX
2026-11-25T17:03:40Z PUSHED main
2026-11-25T17:03:40Z DONE qa-263 (tsc -b, npm test, smoke all green)
2026-11-25T17:04:18Z START qa-246 on qa/qa-246-undo-history-is-lost-when-switching-to-r: Undo history is lost when switching to references.bib and back
2026-11-25T17:10:56Z PUSHED main
2026-11-25T17:10:56Z DONE qa-246 (tsc -b, npm test, smoke all green)
2026-11-25T17:11:34Z START qa-247 on qa/qa-247-a-verbatim-block-containing-end-document: A verbatim block containing \end{document} is rejected as trailing text
2026-11-25T17:14:24Z PUSHED main
2026-11-25T17:14:24Z DONE qa-247 (tsc -b, npm test, smoke all green)
2026-11-25T17:15:02Z START qa-251 on qa/qa-251-a-long-heading-in-the-outline-does-not-w: A long heading in the outline does not wrap; it is clipped and forces a 1,000px horizontal scroll inside the sidebar
2026-11-25T17:57:44Z STASHED as 'qa-loop-autostash-2026-11-25T17:57:44Z' (recover with git stash list)
2026-11-25T17:57:44Z START qa-265 on qa/qa-265-removing-the-bullet-from-a-nested-item-c: Removing the bullet from a nested item creates a second paragraph that the LaTeX merges into the parent item
2026-11-25T18:33:15Z EXPLORE tables: 3 new items, agent exit 0
2026-11-25T18:33:36Z START qa-266 on qa/qa-266-list-item-text-that-starts-with-a-square: List item text that starts with a square bracket is written as an \item optional label and loses its brackets
2026-11-25T18:35:59Z PUSHED main
2026-11-25T18:35:59Z DONE qa-266 (tsc -b, npm test, smoke all green)
2026-11-26T14:45:23Z START qa-270 on qa/qa-270-an-escaped-dollar-inside-inline-math-is: An escaped dollar inside $...$ inline math is read as the closing delimiter and corrupts the formula
2026-11-26T14:46:49Z PUSHED main
2026-11-26T14:46:49Z DONE qa-270 (tsc -b, npm test, smoke all green)
2026-11-26T14:47:28Z START qa-271 on qa/qa-271-a-line-break-inside-inline-math-is-accep: A line break inside $...$ inline math is accepted but the formula is rewritten as literal dollars
2026-11-26T14:49:06Z PUSHED main
2026-11-26T14:49:06Z DONE qa-271 (tsc -b, npm test, smoke all green)
2026-11-26T14:49:46Z START qa-265 on qa/qa-265-removing-the-bullet-from-a-nested-item-c: Removing the bullet from a nested item creates a second paragraph that the LaTeX merges into the parent item
2026-11-26T14:52:00Z PUSHED main
2026-11-26T14:52:00Z DONE qa-265 (tsc -b, npm test, smoke all green)
2026-11-26T14:52:40Z START qa-267 on qa/qa-267-column-resizing-stops-working-and-throws: Column resizing stops working and throws a TypeError on a table with a caption
2026-11-26T14:58:13Z PUSHED main
2026-11-26T14:58:13Z DONE qa-267 (tsc -b, npm test, smoke all green)
2026-11-26T14:58:52Z START qa-268 on qa/qa-268-shift-enter-in-a-table-cell-exports-a-ro: Shift+Enter in a table cell exports a row terminator, so the cell is split into two rows in the PDF
2026-11-26T15:02:42Z PUSHED main
2026-11-26T15:02:42Z DONE qa-268 (tsc -b, npm test, smoke all green)
2026-11-26T15:03:21Z START qa-272 on qa/qa-272-unclosed-or-paragraph-split-display-math: Unclosed or paragraph-split $$ display math is reported as synchronized and exported as escaped literal dollars
2026-11-26T15:05:54Z PUSHED main
2026-11-26T15:05:54Z DONE qa-272 (tsc -b, npm test, smoke all green)
2026-11-26T15:39:30Z EXPLORE links-cites-footnotes: 4 new items, agent exit 0
2026-11-26T15:39:50Z START qa-273 on qa/qa-273-link-addresses-with-or-are-text-escaped: Link addresses with ~, ^, $ or \ are text-escaped, corrupting the PDF hyperlink target
2026-11-26T15:44:43Z PUSHED main
2026-11-26T15:44:43Z DONE qa-273 (tsc -b, npm test, smoke all green)
2026-11-26T15:45:23Z START qa-274 on qa/qa-274-add-edit-link-silently-discards-addresse: Add/Edit link silently discards addresses with an unsupported scheme (doi:, javascript:)
2026-11-26T15:49:01Z PUSHED main
2026-11-26T15:49:01Z DONE qa-274 (tsc -b, npm test, smoke all green)
2026-11-26T15:49:40Z START qa-254 on qa/qa-254-escape-does-not-leave-the-latex-source-e: Escape does not leave the LaTeX source editor, contradicting the status-bar hint
2026-11-26T15:51:20Z PUSHED main
2026-11-26T15:51:20Z DONE qa-254 (tsc -b, npm test, smoke all green)
2026-11-26T15:52:00Z START qa-255 on qa/qa-255-the-latex-source-textarea-has-no-visible: The LaTeX source textarea has no visible focus outline
2026-11-26T15:53:15Z PUSHED main
2026-11-26T15:53:15Z DONE qa-255 (tsc -b, npm test, smoke all green)
2026-11-26T15:53:55Z START qa-256 on qa/qa-256-sidebar-panel-buttons-do-not-expose-whic: Sidebar panel buttons do not expose which panel is open to assistive technology
2026-11-26T15:55:16Z PUSHED main
2026-11-26T15:55:16Z DONE qa-256 (tsc -b, npm test, smoke all green)
2026-11-26T15:55:56Z START qa-257 on qa/qa-257-undo-redo-and-the-indent-buttons-are-ann: Undo, Redo and the indent buttons are announced as toggle buttons with aria-pressed=false
2026-11-26T15:57:19Z PUSHED main
2026-11-26T15:57:19Z DONE qa-257 (tsc -b, npm test, smoke all green)
2026-11-26T16:29:20Z EXPLORE review: 4 new items, agent exit 0
2026-11-26T16:29:40Z START qa-277 on qa/qa-277-rejecting-a-tracked-paragraph-merge-afte: Rejecting a tracked paragraph merge after deleting its comment corrupts the text and resurrects the deleted highlight
2026-11-26T16:40:04Z PUSHED main
2026-11-26T16:40:04Z DONE qa-277 (tsc -b, npm test, smoke all green)
2026-11-26T16:40:45Z START qa-278 on qa/qa-278-ctrl-z-after-accept-or-reject-silently-r: Ctrl+Z after Accept or Reject silently reverses the review decision outside History
2026-11-26T16:49:49Z PUSHED main
2026-11-26T16:49:49Z DONE qa-278 (tsc -b, npm test, smoke all green)
2026-11-26T16:54:57Z BLOCKED qa-258 after 2 attempts — branch qa/qa-258-colour-palettes-never-expose-the-applied kept
2026-11-26T16:56:07Z START qa-259 on qa/qa-259-the-git-panel-ignores-escape-and-is-an-u: The Git panel ignores Escape and is an unnamed complementary region
2026-11-26T16:57:45Z PUSHED main
2026-11-26T16:57:45Z DONE qa-259 (tsc -b, npm test, smoke all green)
2026-11-26T16:58:25Z START qa-260 on qa/qa-260-creating-a-project-from-the-start-screen: Creating a project from the start screen drops keyboard focus on <body>
2026-11-26T17:01:24Z PUSHED main
2026-11-26T17:01:24Z DONE qa-260 (tsc -b, npm test, smoke all green)
2026-11-26T17:02:03Z START qa-264 on qa/qa-264-the-toc-preview-drops-inline-math-from-a: The TOC preview drops inline math from a heading, so its entry does not match the printed contents
2026-11-26T17:04:04Z PUSHED main
2026-11-26T17:04:04Z DONE qa-264 (tsc -b, npm test, smoke all green)
2026-11-26T17:22:46Z EXPLORE source-editor: 2 new items, agent exit 0
2026-11-26T17:23:06Z START qa-281 on qa/qa-281-standard-latex-commands-and-accents-type: Standard LaTeX commands and accents typed in the source render as literal backslashes and are escaped permanently on the
2026-11-26T17:25:45Z PUSHED main
2026-11-26T17:25:45Z DONE qa-281 (tsc -b, npm test, smoke all green)
2026-11-26T17:26:24Z START qa-269 on qa/qa-269-turning-off-the-header-row-of-a-one-row: Turning off the header row of a one-row table leaves its first cell as a header
2026-11-26T17:28:11Z PUSHED main
2026-11-26T17:28:11Z DONE qa-269 (tsc -b, npm test, smoke all green)
2026-11-26T17:28:50Z START qa-275 on qa/qa-275-a-citation-key-or-cross-reference-label: A citation key or cross-reference label containing ~ is accepted but makes the exported LaTeX fail to compile
2026-11-26T17:30:20Z PUSHED main
2026-11-26T17:30:20Z DONE qa-275 (tsc -b, npm test, smoke all green)
2026-11-26T17:30:59Z START qa-276 on qa/qa-276-inserted-citations-and-cross-references: Inserted citations and cross-references cannot be edited in the visual editor; they can only be deleted and reinserted
2026-11-26T17:35:11Z PUSHED main
2026-11-26T17:35:11Z DONE qa-276 (tsc -b, npm test, smoke all green)
2026-11-26T17:35:50Z START qa-279 on qa/qa-279-track-changes-has-no-live-feedback-no-pe: Track changes has no live feedback: no persistent indicator and no insertion marks while typing
2026-11-26T17:39:35Z PUSHED main
2026-11-26T17:39:35Z DONE qa-279 (tsc -b, npm test, smoke all green)
2026-11-26T17:40:15Z PROMOTED from roadmap: qa-283 Start screen: replace the remaining hard-coded colours with tokens
2026-11-26T17:40:15Z START qa-280 on qa/qa-280-multi-line-comment-and-reply-bodies-lose: Multi-line comment and reply bodies lose their line breaks when displayed
2026-11-26T17:41:27Z PUSHED main
2026-11-26T17:41:27Z DONE qa-280 (tsc -b, npm test, smoke all green)
2026-11-26T18:04:22Z EXPLORE long-document: 4 new items, agent exit 0
2026-11-26T18:04:42Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:04:42Z RECOVERED qa-258 (in_progress for 74 min)
2026-11-26T18:04:42Z START qa-284 on qa/qa-284-a-table-taller-than-a-page-is-never-pagi: A table taller than a page is never paginated: page rules cut through rows and rows sit in the margins
2026-11-26T18:14:47Z PUSHED main
2026-11-26T18:14:47Z DONE qa-284 (tsc -b, npm test, smoke all green)
2026-11-26T18:15:27Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:15:27Z START qa-285 on qa/qa-285-the-status-bar-page-count-follows-the-pa: The status-bar page count follows the pane width: Split reports 26 pages and Document properties 23 for the same 13-page
2026-11-26T18:21:38Z PUSHED main
2026-11-26T18:21:38Z DONE qa-285 (tsc -b, npm test, smoke all green)
2026-11-26T18:22:18Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:22:18Z START qa-286 on qa/qa-286-zooming-out-while-at-the-end-leaves-the: Zooming out while at the end leaves the whole document above the viewport, and the scroll range extends past the end of 
2026-11-26T18:29:30Z PUSHED main
2026-11-26T18:29:30Z DONE qa-286 (tsc -b, npm test, smoke all green)
2026-11-26T18:30:10Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:30:10Z START qa-287 on qa/qa-287-find-never-scrolls-the-current-match-int: Find never scrolls the current match into view in a long document
2026-11-26T18:35:04Z PUSHED main
2026-11-26T18:35:04Z DONE qa-287 (tsc -b, npm test, smoke all green)
2026-11-26T18:35:44Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:35:44Z START qa-288 on qa/qa-288-zooming-out-while-at-the-end-leaves-the: Zooming out while at the end leaves the whole document above the viewport, and the scroll range extends past the end of 
2026-11-26T18:43:10Z PUSHED main
2026-11-26T18:43:10Z DONE qa-288 (tsc -b, npm test, smoke all green)
2026-11-26T18:43:49Z IMPORTED 1 tester findings into the backlog
2026-11-26T18:43:49Z START qa-289 on qa/qa-289-zooming-out-while-at-the-end-leaves-the: Zooming out while at the end leaves the whole document above the viewport, and the scroll range extends past the end of 
2026-11-26T18:49:10Z PUSHED main
2026-11-26T18:49:10Z DONE qa-289 (tsc -b, npm test, smoke all green)
2026-11-26T19:04:43Z EXPLORE persistence: 3 new items, agent exit 0
2026-11-26T19:05:03Z IMPORTED 1 tester findings into the backlog
2026-11-26T19:29:18Z START qa-298 on qa/qa-298-add-link-from-the-ribbon-opens-the-dialo: Add link from the ribbon opens the dialog with focus still in the document, so typing edits the manuscript behind the mo
2026-11-26T19:32:38Z PUSHED main
2026-11-26T19:32:38Z DONE qa-298 (tsc -b, npm test, smoke all green)
2026-11-26T19:33:18Z IMPORTED 1 tester findings into the backlog
2026-11-26T19:33:18Z START qa-290 on qa/qa-290-zooming-out-while-at-the-end-leaves-the: Zooming out while at the end leaves the whole document above the viewport, and the scroll range extends past the end of 
