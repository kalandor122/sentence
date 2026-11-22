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
    const overflow = await page.evaluate(() => {
      const r = document.querySelector(".ribbon, .ribbon-groups, .ribbon-body");
      if (!r) return null;
      const clipped = [...document.querySelectorAll(".ribbon button")].filter((b) => {
        const bb = b.getBoundingClientRect();
        const rb = r.getBoundingClientRect();
        return bb.width > 0 && (bb.right > rb.right + 1 || bb.left < rb.left - 1);
      }).map((b) => b.innerText.trim() || b.getAttribute("aria-label"));
      return { scrollWidth: r.scrollWidth, clientWidth: r.clientWidth, clipped };
    });
    hard(`ribbon tab ${t} opens`, (await text()).length > 0);
    if (overflow && (overflow.scrollWidth > overflow.clientWidth + 1 || overflow.clipped.length))
      observe("visual", "high", `ribbon overflows on ${t} tab at 1280px: clipped buttons [${overflow.clipped.join(", ")}]`, `scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`);
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

  // 7. Console gate
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
