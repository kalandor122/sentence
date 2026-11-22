import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEMO_DOCUMENT } from "./defaults";
import { documentToLatex } from "./latex";

const enabled = process.env.SENTENCE_TECTONIC_TEST === "1";
const workspace = resolve(process.cwd());
const testDirectory = resolve(workspace, ".tools", "tectonic-integration");
const engine = resolve(
  workspace,
  "src-tauri",
  "binaries",
  "tectonic-x86_64-pc-windows-msvc.exe",
);
const cache = resolve(workspace, ".tools", "tectonic-cache");

describe("bundled Tectonic PDF pipeline", () => {
  afterAll(() => {
    if (enabled) rmSync(testDirectory, { recursive: true, force: true });
  });

  it.skipIf(!enabled)(
    "compiles a Sentence document",
    () => {
      mkdirSync(testDirectory, { recursive: true });
      mkdirSync(cache, { recursive: true });
      const citedDocument = {
        ...DEMO_DOCUMENT,
        content: [
          ...DEMO_DOCUMENT.content,
          {
            type: "paragraph",
            content: [
              { type: "text", text: "A citation is part of the document. " },
              { type: "citation", attrs: { key: "sentence2026" } },
            ],
          },
        ],
      };
      const source = documentToLatex(citedDocument, {
        ...DEFAULT_SETTINGS,
        title: "The quiet architecture of a sentence",
        author: "Ada Lovelace\nGrace Hopper",
        affiliation: "Analytical Engine Laboratory",
        email: "ada@example.org",
        abstract: "We test an arXiv-ready manuscript pipeline.",
        keywords: "typesetting, reproducibility",
        primaryCategory: "cs.SE",
        crossListCategories: "cs.DL",
        includeToc: false,
      });
      writeFileSync(resolve(testDirectory, "document.tex"), source);
      writeFileSync(
        resolve(testDirectory, "references.bib"),
        "@article{sentence2026, author={Sentence}, title={A Sentence Test}, year={2026}}\n",
      );
      const result = spawnSync(
        engine,
        [
          "document.tex",
          "--outdir",
          testDirectory,
          "--keep-logs",
          "--keep-intermediates",
          "--untrusted",
        ],
        {
          cwd: testDirectory,
          env: { ...process.env, TECTONIC_CACHE_DIR: cache },
          encoding: "utf8",
          timeout: 120_000,
        },
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(existsSync(resolve(testDirectory, "document.pdf"))).toBe(true);
      expect(existsSync(resolve(testDirectory, "document.bbl"))).toBe(true);
    },
    120_000,
  );
});
