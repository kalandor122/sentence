import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  countWords,
  documentToLatex,
  escapeLatex,
  latexToDocument,
} from "./latex";
import type { ProjectSettings, SentenceDocument } from "./types";

const settings: ProjectSettings = {
  ...DEFAULT_SETTINGS,
  title: "A test paper",
  author: "Ada Lovelace",
};

describe("LaTeX generation", () => {
  it("escapes reserved LaTeX characters", () => {
    expect(escapeLatex("50% & $5 #1 a_b {x} ~ ^")).toBe(
      "50\\% \\& \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{}",
    );
  });

  it("serializes rich content and custom nodes", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "A bold title", marks: [{ type: "bold" }] },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Energy is " },
            { type: "mathInline", attrs: { latex: "E=mc^2" } },
            { type: "text", text: " and the result " },
            { type: "citation", attrs: { key: "einstein1905" } },
            { type: "footnote", attrs: { text: "A useful note" } },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First point" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(latex).toContain("\\subsection{\\textbf{A bold title}}");
    expect(latex).toContain("\\(E=mc^2\\)");
    expect(latex).toContain("\\cite{einstein1905}");
    expect(latex).toContain("\\bibliography{references}");
    expect(latex).toContain("\\footnote{A useful note}");
    expect(latex).toContain("\\begin{itemize}");
  });

  it("round-trips the Sentence subset", () => {
    const source: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Opening" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Some " },
            { type: "text", text: "important", marks: [{ type: "italic" }] },
            { type: "text", text: " words." },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "One" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Two" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(source, settings);
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.settings.title).toBe("A test paper");
    expect(parsed.document.content[0]?.type).toBe("heading");
    expect(parsed.document.content[1]?.content?.[1]?.marks?.[0]?.type).toBe("italic");
    expect(parsed.document.content[2]?.type).toBe("bulletList");
  });

  it("keeps paragraph and heading alignment in LaTeX", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [{ type: "text", text: "test" }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [{ type: "text", text: "Right words" }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [{ type: "text", text: "Left words" }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [{ type: "text", text: "Justified words" }],
        },
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            { type: "mathInline", attrs: { latex: "a^{2}+b^{2}=c^{2}" } },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2, textAlign: "center" },
          content: [{ type: "text", text: "Centered heading" }],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\begin{center}\ntest\n\\end{center}");
    expect(latex).toContain("\\begin{flushright}\nRight words\n\\end{flushright}");
    expect(latex).toContain("\\begin{flushleft}\nLeft words\n\\end{flushleft}");
    expect(latex).toContain("Justified words");
    expect(latex).toContain("\\begin{center}\n\\(a^{2}+b^{2}=c^{2}\\)\n\\end{center}");
    expect(latex).toContain("\\begin{center}\n\\subsection{Centered heading}\n\\end{center}");
    expect(latex.match(/\\begin\{center\}/g) ?? []).toHaveLength(3);

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    const [centered, right, left, justified, equation, centeredHeading] =
      parsed.document.content;
    expect(centered?.attrs?.textAlign).toBe("center");
    expect(centered?.content?.[0]?.text).toBe("test");
    expect(right?.attrs?.textAlign).toBe("right");
    expect(left?.attrs?.textAlign).toBe("left");
    expect(justified?.attrs?.textAlign).toBeUndefined();
    expect(equation?.attrs?.textAlign).toBe("center");
    expect(equation?.content?.[0]?.type).toBe("mathInline");
    expect(centeredHeading?.type).toBe("heading");
    expect(centeredHeading?.attrs?.textAlign).toBe("center");
    expect(centeredHeading?.attrs?.level).toBe(2);
  });

  it("round-trips page breaks", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First page." }] },
        { type: "pageBreak" },
        { type: "paragraph", content: [{ type: "text", text: "Second page." }] },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("First page.\n\n\\newpage\n\nSecond page.");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.document.content[1]?.type).toBe("pageBreak");
    expect(parsed.document.content[2]?.content?.[0]?.text).toBe("Second page.");
  });

  it("emits and round-trips typography settings", () => {
    const mainFontSpec =
      "Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic";
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Typography test." }] },
      ],
    };
    const styled: ProjectSettings = {
      ...settings,
      fontFamily: "times",
      lineSpacing: "onehalf",
      paragraphSpacing: "gap",
    };
    const latex = documentToLatex(document, styled);
    expect(latex).toContain("\\usepackage{fontspec}");
    expect(latex).toContain(`\\setmainfont[${mainFontSpec}]{texgyretermes}`);
    expect(latex).toContain("\\usepackage{setspace}");
    expect(latex).toContain("\\onehalfspacing");
    expect(latex).toContain("\\usepackage{parskip}");
    expect(latex).not.toContain(`\\setmainfont[${mainFontSpec}]{texgyrepagella}`);

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.settings.fontFamily).toBe("times");
    expect(parsed.settings.lineSpacing).toBe("onehalf");
    expect(parsed.settings.paragraphSpacing).toBe("gap");

    const doubleLatex = documentToLatex(document, {
      ...settings,
      fontFamily: "palatino",
      lineSpacing: "double",
    });
    expect(doubleLatex).toContain(`\\setmainfont[${mainFontSpec}]{texgyrepagella}`);
    expect(doubleLatex).toContain("\\doublespacing");
    const doubleParsed = latexToDocument(doubleLatex, DEFAULT_SETTINGS);
    expect(doubleParsed.settings.fontFamily).toBe("palatino");
    expect(doubleParsed.settings.lineSpacing).toBe("double");

    const plain = documentToLatex(document, settings);
    expect(plain).toContain(`\\setmainfont[${mainFontSpec}]{lmroman10}`);
    expect(plain).not.toContain(`\\setmainfont[${mainFontSpec}]{texgyretermes}`);
    expect(plain).not.toContain("setspace");
    expect(plain).not.toContain("parskip");
    const plainParsed = latexToDocument(plain, DEFAULT_SETTINGS);
    expect(plainParsed.settings.fontFamily).toBe("default");
    expect(plainParsed.settings.lineSpacing).toBe("single");
    expect(plainParsed.settings.paragraphSpacing).toBe("indent");
  });

  it("serializes and round-trips per-selection text styles", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Plain " },
            {
              type: "text",
              text: "Times serif",
              marks: [{ type: "fontFamily", attrs: { family: "times" } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "sans words",
              marks: [{ type: "fontFamily", attrs: { family: "sans" } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "big words",
              marks: [{ type: "fontSize", attrs: { size: "large" } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "red words",
              marks: [{ type: "color", attrs: { color: "#c00000" } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "marked words",
              marks: [{ type: "highlight", attrs: { color: "#fff3a3" } }],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "bold sans",
              marks: [
                { type: "bold" },
                { type: "fontFamily", attrs: { family: "mono" } },
              ],
            },
            { type: "text", text: "." },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\usepackage{xcolor}");
    expect(latex).toContain("{\\sentenceTimes Times serif}");
    expect(latex).toContain("{\\sffamily sans words}");
    expect(latex).toContain("{\\ttfamily \\textbf{bold sans}}");
    expect(latex).toContain("{\\large big words}");
    expect(latex).toContain("{\\color{red} red words}");
    expect(latex).toContain("\\colorbox{yellow}{marked words}");

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    const texts = parsed.document.content[0]?.content ?? [];
    const marksOf = (text: string) =>
      texts.find((node) => node.text === text)?.marks ?? [];
    expect(marksOf("Times serif")).toContainEqual(
      expect.objectContaining({ type: "fontFamily", attrs: { family: "times" } }),
    );
    expect(marksOf("sans words")).toContainEqual(
      expect.objectContaining({ type: "fontFamily", attrs: { family: "sans" } }),
    );
    expect(marksOf("big words")).toContainEqual(
      expect.objectContaining({ type: "fontSize", attrs: { size: "large" } }),
    );
    expect(marksOf("red words")).toContainEqual(
      expect.objectContaining({ type: "color", attrs: { color: "#c00000" } }),
    );
    expect(marksOf("marked words")).toContainEqual(
      expect.objectContaining({ type: "highlight", attrs: { color: "#fff3a3" } }),
    );
    expect(marksOf("bold sans")).toContainEqual({ type: "bold" });
    expect(marksOf("bold sans")).toContainEqual(
      expect.objectContaining({ type: "fontFamily", attrs: { family: "mono" } }),
    );
    expect(marksOf("Plain ")).toHaveLength(0);

    const plainLatex = documentToLatex(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Nothing styled." }] },
        ],
      },
      settings,
    );
    expect(plainLatex).not.toContain("xcolor");
  });

  it("generates and parses arXiv paper metadata", () => {
    const paperSettings: ProjectSettings = {
      ...DEFAULT_SETTINGS,
      title: "A reproducible paper",
      author: "Ada Lovelace\nGrace Hopper",
      affiliation: "Analytical Engine Laboratory",
      email: "ada@example.org",
      abstract:
        "We study a reproducible workflow.\n\nIt is easy to submit to arXiv.",
      keywords: "reproducibility, typesetting",
      primaryCategory: "cs.SE",
      crossListCategories: "cs.DL",
      arxivComment: "12 pages, 3 figures",
    };
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "A reproducible paper" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Introduction body." }],
        },
      ],
    };
    const latex = documentToLatex(document, paperSettings);
    expect(latex).toContain("\\author{Ada Lovelace \\and Grace Hopper\\\\[7pt]");
    expect(latex).toContain("\\begin{abstract}");
    expect(latex).toContain("\\par");
    expect(latex).toContain("\\keywords{reproducibility, typesetting}");
    expect(latex).toContain("% arXiv primary category: cs.SE");
    expect(latex).toContain("% arXiv cross-list categories: cs.DL");
    expect(latex).toContain("% arXiv comments: 12 pages, 3 figures");
    expect(latex).toContain("% Sentence affiliation: Analytical Engine Laboratory");
    expect(latex).toContain("ada@example.org");
    expect(latex).not.toContain("\\section{A reproducible paper}");

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.settings.author).toBe("Ada Lovelace\nGrace Hopper");
    expect(parsed.settings.affiliation).toBe("Analytical Engine Laboratory");
    expect(parsed.settings.email).toBe("ada@example.org");
    expect(parsed.settings.abstract).toContain("reproducible workflow");
    expect(parsed.settings.keywords).toBe("reproducibility, typesetting");
    expect(parsed.settings.primaryCategory).toBe("cs.SE");
    expect(parsed.settings.crossListCategories).toBe("cs.DL");
  });
});

describe("document statistics", () => {
  it("counts words across block and inline nodes", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "One two three" }],
        },
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Four five" }],
        },
      ],
    };
    expect(countWords(document)).toBe(5);
  });
});
