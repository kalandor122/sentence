#!/usr/bin/env node
// Sentence QA smoke gate. Drives the real UI in Chromium against the Vite dev
// server and writes qa/report.json. Hard checks fail the gate; observations are
// recorded for the loop's backlog and never fail it.
//
// ponytail: one file, no test framework — the loop needs a gate it can trust,
// not a suite it has to maintain.

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BASE || "http://localhost:1420";
const OUT = "qa/shots";
const report = { startedAt: new Date().toISOString(), base: BASE, failures: [], observations: [], consoleErrors: [], steps: [] };

function chromiumPath() {
  const root = `${process.env.HOME}/.cache/ms-playwright`;
  const dirs = readdirSync(root).filter((d) => d.startsWith("chromium-")).sort();
  for (const d of dirs.reverse()) {
    for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
      const p = join(root, d, sub);
      try { readdirSync(p.replace(/\/chrome$/, "")); return p; } catch {}
    }
  }
  throw new Error("no chromium in ~/.cache/ms-playwright");
}

const hard = (name, ok, detail) => {
  report.steps.push({ name, ok });
  if (!ok) report.failures.push({ check: name, detail: detail ?? null });
};
const observe = (category, severity, note, evidence) =>
  report.observations.push({ category, severity, note, evidence: evidence ?? null });

const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text().slice(0, 400)); });
page.on("pageerror", (e) => report.consoleErrors.push(`pageerror: ${e.message}`.slice(0, 400)));

const shot = async (name) => { mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const text = () => page.evaluate(() => document.body.innerText);

try {
  // 1. Start screen
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const startText = await text();
  hard("start screen renders", /New document|Create a project/i.test(startText));
  if (/Sentence 0\.1\b/.test(startText)) observe("content", "low", "start screen footer shows version 0.1 while package.json is 0.2.0 — hardcoded version?", "Sentence 0.1 in footer");
  await shot("01-start");

  // 2. Enter editor
  const create = page.getByRole("button", { name: /create a project|new document/i }).first();
  hard("create button present", (await create.count()) > 0);
  await create.click();
  await page.waitForTimeout(900);
  const editorText = await text();
  hard("editor opens", /Compile|Home|Insert/i.test(editorText));
  await shot("02-editor");

  // 3. Ribbon tabs and overflow
  const tabs = ["Home", "Insert", "Layout", "References", "Review", "Paper", "View", "Git"];
  for (const t of tabs) {
    const tab = page.getByRole("tab", { name: t }).or(page.getByRole("button", { name: t, exact: true })).first();
    if ((await tab.count()) === 0) { hard(`ribbon tab ${t}`, false, "tab missing"); continue; }
    await tab.click();
    await page.waitForTimeout(250);
    hard(`ribbon tab ${t} opens`, (await text()).length > 0);
    const overflow = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("section.ribbon button")];
      const offscreen = btns.filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
      }).map((b) => (b.innerText || b.getAttribute("aria-label") || "").trim());
      const content = document.querySelector(".ribbon-content");
      const scrolls = content ? content.scrollWidth - content.clientWidth : 0;
      const docScroll = document.documentElement.scrollWidth - window.innerWidth;
      return { offscreen, scrolls, docScroll };
    });
    hard(`ribbon fits at 1280px on ${t}`, overflow.offscreen.length === 0 && overflow.scrolls <= 1 && overflow.docScroll <= 1,
      `offscreen=[${overflow.offscreen.join(", ")}] contentOverflow=${overflow.scrolls}px docOverflow=${overflow.docScroll}px`);
    await shot(`03-ribbon-${t.toLowerCase()}`);
  }

  // 4. Typing in the page
  const surface = page.locator(".tiptap, .ProseMirror, [contenteditable='true']").first();
  hard("editor surface present", (await surface.count()) > 0);
  if (await surface.count()) {
    await surface.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("smoke marker alpha");
    await page.waitForTimeout(400);
    const typed = await text();
    hard("typing reaches the document", /smoke marker alpha/.test(typed));

    // Bold via shortcut should produce a <strong> run
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type(" bold run");
    await page.waitForTimeout(300);
    const bolded = await page.evaluate(() => !!document.querySelector(".tiptap strong, .ProseMirror strong"));
    hard("Ctrl+B bolds text", bolded);

    // Landscape feature probe: do standard Word shortcuts do anything?
    for (const [label, keys] of [["Ctrl+Shift+7 numbered list", "ControlOrMeta+Shift+7"], ["Ctrl+K link", "ControlOrMeta+k"], ["Ctrl+5 line spacing", "ControlOrMeta+5"], ["Tab indent", "Tab"]]) {
      const before = await page.evaluate(() => document.querySelector(".tiptap, .ProseMirror")?.innerHTML.length ?? 0);
      await page.keyboard.press(keys);
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => document.querySelector(".tiptap, .ProseMirror")?.innerHTML.length ?? 0);
      if (before === after) observe("ux", "low", `keyboard shortcut "${label}" has no visible effect on the document`, "innerHTML unchanged");
      // A shortcut may legitimately open a dialog (link, find). Close it before the
      // next probe, otherwise the modal swallows the clicks later in this script.
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      if (await surface.count()) await surface.click({ timeout: 2000 }).catch(() => {});
      await page.keyboard.press("ControlOrMeta+z");
    }
    await shot("04-typed");
  }

  // 5. LaTeX source view
  const srcToggle = page.getByRole("button", { name: /source|^split$|visual/i }).first();
  if ((await srcToggle.count()) === 0) observe("ux", "medium", "no discoverable control to switch to LaTeX source view from the editor chrome", null);
  else {
    await srcToggle.click();
    await page.waitForTimeout(500);
    const src = await page.evaluate(() => {
      const ta = document.querySelector("textarea, .source-editor, [data-mode='source']");
      return ta ? (ta.value ?? ta.textContent ?? "") : null;
    });
    if (src === null) observe("functional", "medium", "source view toggle did not reveal an editable LaTeX surface", null);
    else hard("LaTeX source contains typed text", /smoke marker alpha/.test(src), String(src).slice(0, 200));
    await shot("05-source");
  }

  // 6. Desktop-only paths must degrade with a message, not a crash
  const compile = page.getByRole("button", { name: /^compile$/i }).first();
  if (await compile.count()) {
    await compile.click();
    await page.waitForTimeout(700);
    const after = await text();
    const explained = /desktop application|not available|Save the project/i.test(after);
    hard("compile degrades gracefully in browser", explained, after.slice(-300));
    await shot("06-compile");
  } else observe("functional", "high", "no Compile control found in the ribbon", null);

  // 7. Regressions that shipped once and must not come back
  // The ribbon tabs now expose role=tab; match either so a role change can never
  // silently skip this block again.
  const viewTab = page.getByRole("tab", { name: "View", exact: true })
    .or(page.getByRole("button", { name: "View", exact: true })).first();
  if (await viewTab.count()) {
    // Ctrl+F find bar
    await page.keyboard.press("ControlOrMeta+f");
    await page.waitForTimeout(400);
    const bar = page.locator(".find-bar input").first();
    hard("Ctrl+F opens the find bar", (await bar.count()) > 0);
    if (await bar.count()) {
      await bar.fill("the");
      await page.waitForTimeout(500);
      const barText = (await page.locator(".find-bar").first().innerText()).replace(/\s+/g, " ");
      hard("find reports a match count", /\d+\s*\/\s*\d+/.test(barText), barText.slice(0, 120));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      hard("Escape closes the find bar", (await page.locator(".find-bar").count()) === 0);
    }

    // Ctrl+K link dialog, and it must not keep the page blocked after Escape
    const surfaceNow = surface;
    if (await surfaceNow.count()) { await surfaceNow.click(); await page.keyboard.press("ControlOrMeta+End"); }
    await page.keyboard.press("ControlOrMeta+k");
    await page.waitForTimeout(400);
    const dialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"], .modal, .dialog');
      return d ? d.innerText.replace(/\s+/g, " ").slice(0, 80) : null;
    });
    hard("Ctrl+K opens the link dialog", Boolean(dialog), String(dialog));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Nested list LaTeX round trip (visual -> source -> visual)
    const wordsBefore = await page.evaluate(() => {
      const m = /([\d,]+)\s+words/.exec(document.querySelector(".status-bar")?.innerText ?? "");
      return m ? Number(m[1].replace(/,/g, "")) : 0;
    });
    await viewTab.click();
    await page.waitForTimeout(200);
    const latexBtn = page.getByRole("tab", { name: "LaTeX", exact: true })
      .or(page.getByRole("button", { name: "LaTeX", exact: true })).first();
    hard("View tab exposes a LaTeX button", (await latexBtn.count()) > 0);
    if (await latexBtn.count()) {
      await latexBtn.click();
      await page.waitForTimeout(500);
      const area = page.locator('textarea[aria-label="LaTeX source"]').first();
      hard("source view shows the LaTeX textarea", (await area.count()) > 0);
      if (await area.count()) {
        const before = await area.inputValue();
        const marker = "\\end{document}";
        const at = before.lastIndexOf(marker);
        const list = "\n\\begin{itemize}\n\\item parent item\n\\begin{enumerate}\n\\item child item\n\\end{enumerate}\n\\end{itemize}\n";
        const injected = at >= 0 ? before.slice(0, at) + list + before.slice(at) : before + list;
        await area.fill(injected);
        await page.waitForTimeout(900);
        await page.getByRole("button", { name: "Visual", exact: true })
          .or(page.getByRole("tab", { name: "Visual", exact: true })).first().click();
        await page.waitForTimeout(700);
        const roundTrip = await page.evaluate(() => {
          const ed = document.querySelector(".tiptap, .ProseMirror");
          if (!ed) return null;
          const nested = [...ed.querySelectorAll("ul ol, ol ul, ul ul, ol ol")].length;
          return { nested, leaked: /\\begin\{itemize\}|\\end\{itemize\}/.test(ed.innerText) };
        });
        hard("nested lists survive the source round trip", Boolean(roundTrip && roundTrip.nested > 0 && !roundTrip.leaked),
          JSON.stringify(roundTrip));
        const wordsAfter = await page.evaluate(() => {
          const m = /([\d,]+)\s+words/.exec(document.querySelector(".status-bar")?.innerText ?? "");
          return m ? Number(m[1].replace(/,/g, "")) : 0;
        });
        // The editor used to emit an empty document on remount and wipe everything.
        hard("editing the LaTeX source keeps the document", wordsAfter >= wordsBefore && wordsAfter > 0,
          `words ${wordsBefore} -> ${wordsAfter}`);
        await shot("07-roundtrip");
      }
    }
  } else {
    hard("source-view round trip checks ran", false, "no View ribbon tab found — the regression block would be skipped silently");
  }

  // 8. Console gate
  hard("no console errors", report.consoleErrors.length === 0, report.consoleErrors.slice(0, 5).join(" | "));
} catch (e) {
  report.failures.push({ check: "harness", detail: String(e).slice(0, 500) });
  try { await shot("99-failure"); } catch {}
} finally {
  report.finishedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;
  mkdirSync("qa", { recursive: true });
  writeFileSync("qa/report.json", JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`${report.ok ? "PASS" : "FAIL"} failures=${report.failures.length} observations=${report.observations.length} consoleErrors=${report.consoleErrors.length}`);
  for (const f of report.failures) console.log(`  FAIL ${f.check}: ${f.detail ?? ""}`);
  process.exit(report.ok ? 0 : 1);
}
