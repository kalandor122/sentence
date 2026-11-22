import { describe, it, expect } from "vitest";
import { documentToLatex, latexToDocument } from "./latex";
import type { ProjectSettings } from "./types";

const settings: ProjectSettings = {
  title: "", author: "", date: "", abstract: "", keywords: "",
  affiliation: "", email: "", header: "", footer: "", subtitle: "",
  primaryCategory: "", crossListCategories: "", arxivComment: "",
  fontSize: "11pt", paperSize: "letterpaper", documentClass: "article",
  fontFamily: "default", lineSpacing: "single", paragraphSpacing: "indent",
  margins: "1in", lineNumbers: false, includeToc: false,
};

const nestedLatex = [
  "\\documentclass[11pt,letterpaper]{article}",
  "\\begin{document}",
  "\\begin{itemize}",
  "\\item parent item",
  "\\begin{enumerate}",
  "\\item child item",
  "\\end{enumerate}",
  "\\end{itemize}",
  "\\end{document}",
].join("\n");

describe("nested debug", () => {
  it("parses nested list", () => {
    const { document } = latexToDocument(nestedLatex, settings);
    const output = documentToLatex(document, settings);
    expect({ doc: JSON.stringify(document), out: output }).toEqual({ doc: "SHOW", out: "SHOW" });
  });
});
