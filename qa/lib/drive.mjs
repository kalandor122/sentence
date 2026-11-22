// Tiny Playwright driver shared by the QA probe scripts. Import it, drive the
// app, print JSON. Fails loudly if the dev server is not up.
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const BASE = process.env.QA_BASE || "http://localhost:1420";

export function chromiumPath() {
  const root = `${process.env.HOME}/.cache/ms-playwright`;
  for (const d of readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
    for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
      try { readdirSync(join(root, d, sub.replace(/\/chrome$/, ""))); return join(root, d, sub); } catch {}
    }
  }
  throw new Error("no chromium in ~/.cache/ms-playwright");
}

export async function drive(fn, { width = 1280, height = 800, editor = true } = {}) {
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`.slice(0, 300)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (editor) {
      const create = page.getByRole("button", { name: /create a project|new document/i }).first();
      if (await create.count()) await create.click();
      await page.waitForTimeout(800);
    }
    return await fn(page, errors);
  } finally {
    await browser.close();
  }
}

export const surface = (page) => page.locator(".tiptap, .ProseMirror, [contenteditable='true']").first();

export async function type(page, text) {
  await surface(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(text);
  await page.waitForTimeout(300);
}

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

export async function shot(page, name) {
  await page.screenshot({ path: `qa/shots/probe-${name}.png` });
}
