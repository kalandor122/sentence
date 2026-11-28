import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  countWords,
  documentPlainText,
  documentToLatex,
  escapeLatex,
  isLatexCitationTarget,
  isLatexReferenceTarget,
  latexToDocument,
  restoreImageSources,
  uniqueImageAssetPath,
} from "./latex";
import type { DocumentNode, ProjectSettings, SentenceDocument } from "./types";

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

  it("writes a non-breaking space as ~ and keeps a typed tilde visible", () => {
    expect(escapeLatex("Eq.\u00a01")).toBe("Eq.~1");
    expect(escapeLatex("Eq.\u00a01 ~")).toBe("Eq.~1 \\textasciitilde{}");
  });

  it("keeps LaTeX's non-breaking space through a source round trip", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "ZXTILDE see Eq.~1 and Fig.~2.",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(documentPlainText(document)).toBe("ZXTILDE see Eq.\u00a01 and Fig.\u00a02.");
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).toContain("ZXTILDE see Eq.~1 and Fig.~2.");
    expect(exported).not.toContain("\\textasciitilde{}");
  });

  it("reads text commands and accents as the text they print", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\section{Writing \\LaTeX{} with Sentence}",
      "",
      "A caf\\'e typed with \\TeX{} and \\ldots{} more, \\c{c}a va.",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(documentPlainText(document)).toBe(
      "Writing LaTeX with Sentence\n\nA café typed with TeX and … more, ça va.",
    );
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).toContain("\\section{Writing LaTeX with Sentence}");
    expect(exported).toContain("A café typed with TeX and … more, ça va.");
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("keeps a tilde in a link URL part of the address", () => {
    const { document } = latexToDocument(
      [
        "\\documentclass{article}",
        "\\begin{document}",
        "\\href{https://example.org/~user}{profile}",
        "\\end{document}",
      ].join("\n"),
      DEFAULT_SETTINGS,
    );
    expect(document.content[0]?.content?.[0]?.marks).toContainEqual({
      type: "link",
      attrs: { href: "https://example.org/~user" },
    });
  });

  it("refuses citation keys and labels that would break their LaTeX command", () => {
    expect(isLatexReferenceTarget("einstein1905")).toBe(true);
    expect(isLatexReferenceTarget("fig:architecture")).toBe(true);
    expect(isLatexReferenceTarget("bad key}")).toBe(false);
    expect(isLatexReferenceTarget("fig}")).toBe(false);
    expect(isLatexReferenceTarget("a{b")).toBe(false);
    expect(isLatexReferenceTarget("a%b")).toBe(false);
    expect(isLatexReferenceTarget("a,b")).toBe(false);
    expect(isLatexReferenceTarget("a~b")).toBe(false);
  });

  it("keeps exported citation keys and labels syntactically valid", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "BadCite " },
            { type: "citation", attrs: { key: "bad key}" } },
            { type: "text", text: " BadRef " },
            { type: "crossReference", attrs: { label: "fig}" } },
            { type: "text", text: " TildeCite " },
            { type: "citation", attrs: { key: "a~b" } },
            { type: "text", text: " TildeRef " },
            { type: "crossReference", attrs: { label: "fig~one" } },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("BadCite \\cite{badkey}");
    expect(latex).toContain("BadRef \\ref{fig}");
    expect(latex).not.toContain("bad key}}");
    expect(latex).toContain("TildeCite \\cite{ab}");
    expect(latex).toContain("TildeRef \\ref{figone}");
  });

  it("keeps the keys of a multi-key citation separate", () => {
    expect(isLatexCitationTarget("einstein1905,knuth1984")).toBe(true);
    expect(isLatexCitationTarget("einstein1905, knuth1984")).toBe(true);
    expect(isLatexCitationTarget("einstein1905,")).toBe(false);
    expect(isLatexCitationTarget("einstein1905,bad key")).toBe(false);

    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "MultiCite " },
            { type: "citation", attrs: { key: "sentence2026,ghost2026" } },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("MultiCite \\cite{sentence2026,ghost2026}");

    const parsed = latexToDocument(latex, settings).document;
    const citation = (parsed.content[0]?.content ?? []).find((node) => node.type === "citation");
    expect(citation?.attrs?.key).toBe("sentence2026,ghost2026");
    expect(documentToLatex(parsed, settings)).toContain("\\cite{sentence2026,ghost2026}");
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

  it("round-trips escaped braces and ampersands inside footnotes", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Brace note " },
            { type: "footnote", attrs: { text: "Note with } and &" } },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\footnote{Note with \\} and \\&}");

    const parsed = latexToDocument(latex, settings).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.[0]?.text).toBe("Brace note ");
    expect(paragraph?.content?.[1]?.type).toBe("footnote");
    expect(paragraph?.content?.[1]?.attrs?.text).toBe("Note with } and &");
    expect(documentToLatex(parsed, settings)).toContain(
      "\\footnote{Note with \\} and \\&}",
    );
  });

  it("protects a footnote inside a heading and round-trips it", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            { type: "text", text: "Heading footnote" },
            { type: "footnote", attrs: { text: "Heading note" } },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Body " },
            { type: "footnote", attrs: { text: "Body note" } },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain(
      "\\section{Heading footnote\\protect\\footnote{Heading note}}",
    );
    expect(latex).toContain("Body \\footnote{Body note}");

    const parsed = latexToDocument(latex, settings).document;
    const heading = parsed.content[0];
    expect(heading?.type).toBe("heading");
    expect(heading?.content?.find((node) => node.type === "footnote")?.attrs?.text).toBe(
      "Heading note",
    );
    expect(documentToLatex(parsed, settings)).toContain(
      "\\section{Heading footnote\\protect\\footnote{Heading note}}",
    );
  });

  it("keeps the inline formatting of an imported footnote through a round trip", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "Formatted note \\footnote{See \\textit{Smith} and \\textbf{Jones}.} end.",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    const note = parsed.content[0]?.content?.find((node) => node.type === "footnote");
    expect(note?.attrs?.text).toBe("See \\textit{Smith} and \\textbf{Jones}.");

    const exported = documentToLatex(parsed, DEFAULT_SETTINGS);
    expect(exported).toContain(
      "\\footnote{See \\textit{Smith} and \\textbf{Jones}.}",
    );
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("ignores LaTeX comments in the body instead of importing them as text", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "Body text % trailing comment",
      "% whole-line comment",
      "",
      "Second paragraph with a literal \\% sign",
      "",
      "Joined first",
      "% inner comment",
      "joined second",
      "",
      "\\begin{verbatim}",
      "keep % inside verbatim",
      "\\end{verbatim}",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(documentPlainText(document)).toBe(
      "Body text\n\nSecond paragraph with a literal % sign\n\nJoined first\njoined second\n\nkeep % inside verbatim",
    );
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).not.toContain("trailing comment");
    expect(exported).not.toContain("whole-line comment");
    expect(exported).toContain("Second paragraph with a literal \\% sign");
  });

  it("writes verbatim code exactly as typed", () => {
    const code = 'ZXCODE printf("%d", a_b & c);';
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{verbatim}",
      code,
      "\\end{verbatim}",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(documentPlainText(document)).toBe(code);
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).toContain(`\\begin{verbatim}\n${code}\n\\end{verbatim}`);
    expect(exported).not.toContain("\\%d");
    expect(exported).not.toContain("a\\_b");
    expect(exported).not.toContain("\\& c");
  });

  it("keeps text after a commented-out end{document}", () => {
    const latex = [
      "\\documentclass{article}",
      "% \\begin{document}",
      "\\begin{document}",
      "Before comment.",
      "",
      "% ZXCOMMENTED \\end{document} marker",
      "",
      "ZXAFTERCOMMENT paragraph",
      "",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(documentPlainText(document)).toBe(
      "Before comment.\n\nZXAFTERCOMMENT paragraph",
    );
    expect(documentToLatex(document, DEFAULT_SETTINGS)).toContain(
      "ZXAFTERCOMMENT paragraph",
    );
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

  it("keeps generated bibliography directives intact through a source round trip", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "citation", attrs: { key: "sentence2026" } },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex.match(/\\bibliographystyle\{plain\}/g)).toHaveLength(1);
    expect(latex.match(/\\bibliography\{references\}/g)).toHaveLength(1);

    const parsed = latexToDocument(latex, settings).document;
    expect(parsed.content.map((node) => node.type)).toEqual(["paragraph"]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toBe(latex);
    expect(exported).not.toContain("\\textbackslash{}bibliographystyle");
    expect(exported).not.toContain("\\textbackslash{}bibliography");
  });

  it("round-trips \\texttt as inline code without dropping the body", () => {
    const latex = [
      "\\begin{document}",
      "\\section{Title}",
      "",
      "Existing body.",
      "",
      "Code: \\texttt{CODE MARKER}",
      "",
      "\\begin{quote}",
      "Quoted text.",
      "\\end{quote}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "blockquote",
    ]);
    expect(parsed.content[2]?.content?.[1]?.text).toBe("CODE MARKER");
    expect(parsed.content[2]?.content?.[1]?.marks).toEqual([{ type: "code" }]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Existing body.");
    expect(exported).toContain("Code: \\texttt{CODE MARKER}");
    expect(exported).toContain("\\begin{quote}");
  });

  it("reads \\emph as italic and exports it as \\textit", () => {
    const latex = [
      "\\begin{document}",
      "",
      "ZXEMPH before \\emph{important word} after.",
      "",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    expect(parsed.content[0]?.content).toEqual([
      { type: "text", text: "ZXEMPH before " },
      { type: "text", text: "important word", marks: [{ type: "italic" }] },
      { type: "text", text: " after." },
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("ZXEMPH before \\textit{important word} after.");
    expect(exported).not.toContain("\\textbackslash{}emph");
  });

  it("rejects LaTeX with a missing document end instead of clearing the body", () => {
    const source = [
      "\\begin{document}",
      "SENTINEL BEFORE BREAK",
      "",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).toThrow(
      "Invalid LaTeX: missing \\end{document}.",
    );
  });

  it("rejects text after \\end{document} instead of discarding it", () => {
    const source = [
      "\\begin{document}",
      "Body text.",
      "\\end{document}",
      "",
      "trailing paragraph tail-1",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: text after \\end{document} is not part of the document ("trailing paragraph tail-1"). Move it before \\end{document}.',
    );
    const sameLine = "\\begin{document}\nBody.\n\\end{document} ZXTRAILINGTAIL";
    expect(() => latexToDocument(sameLine, DEFAULT_SETTINGS)).toThrow(
      'text after \\end{document}',
    );
  });

  it("ignores \\end{document} inside a verbatim block", () => {
    const source = [
      "\\begin{document}",
      "Before.",
      "\\begin{verbatim}",
      "ZXCODE \\end{document}",
      "ZXCODE still code",
      "\\end{verbatim}",
      "After.",
      "\\end{document}",
    ].join("\n");
    const { document } = latexToDocument(source, DEFAULT_SETTINGS);
    const code = document.content.find((node) => node.type === "codeBlock");
    expect(code?.content?.[0]?.text).toBe(
      "ZXCODE \\end{document}\nZXCODE still code",
    );
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).toContain("ZXCODE \\end{document}");
    expect(exported).toContain("\\end{verbatim}");
  });

  it("accepts blank lines and comments after \\end{document}", () => {
    const source = [
      "\\begin{document}",
      "Body text.",
      "\\end{document}",
      "",
      "% End of document",
      "",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).not.toThrow();
  });

  it("rejects an unbalanced table environment instead of storing it as text", () => {
    const source = [
      "\\begin{document}",
      "\\section{Unbalanced section}",
      "\\begin{table}[htbp]",
      "SENTINEL UNBALANCED",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unbalanced environment "table".',
    );
  });

  it("rejects an environment outside the supported subset instead of escaping it", () => {
    for (const name of ["description", "theorem"]) {
      const source = [
        "\\begin{document}",
        `\\begin{${name}}`,
        `ZX${name.toUpperCase()} body text.`,
        `\\end{${name}}`,
        "\\end{document}",
      ].join("\n");
      expect(() => latexToDocument(source, DEFAULT_SETTINGS)).toThrow(
        `Invalid LaTeX: unsupported environment "${name}".`,
      );
    }
  });

  it("rejects an unsupported environment nested in a quote", () => {
    const source = [
      "\\begin{document}",
      "\\begin{quote}",
      "\\begin{description}",
      "\\item[ZXTERM] ZXTERM definition text.",
      "\\end{description}",
      "\\end{quote}",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unsupported environment "description".',
    );
  });

  it("keeps a cases environment inside display math", () => {
    const source = [
      "\\begin{document}",
      "\\begin{equation}",
      "f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}",
      "\\end{equation}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content[0]?.type).toBe("mathBlock");
    expect(parsed.content[0]?.attrs?.latex).toContain("\\begin{cases}");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}");
    expect(exported).not.toContain("\\textbackslash{}begin\\{cases\\}");
  });

  it("rejects a missing closing brace instead of rewriting the content", () => {
    const tabular = [
      "\\begin{document}",
      "\\begin{tabular}{ll",
      "ZXCOLCELL & 7 \\\\",
      "\\end{tabular}",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(tabular, DEFAULT_SETTINGS)).toThrow(
      "Invalid LaTeX: missing closing brace.",
    );
    const heading = [
      "\\begin{document}",
      "\\section{ZXSEC UNCLOSED",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(heading, DEFAULT_SETTINGS)).toThrow(
      "Invalid LaTeX: missing closing brace.",
    );
  });

  it("accepts escaped braces when checking brace balance", () => {
    const source = [
      "\\begin{document}",
      "A literal \\{ brace and \\} brace.",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).not.toThrow();
  });

  it("rejects unclosed math delimiters instead of storing them as text", () => {
    const paren = [
      "\\begin{document}",
      "ZXUNCLOSEDPAREN \\(a^2 + b^2",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(paren, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "\\(".',
    );
    const dollar = [
      "\\begin{document}",
      "ZXUNCLOSEDDOLLAR $a^2 + b^2",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(dollar, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "$".',
    );
    const bracket = [
      "\\begin{document}",
      "\\[a^2 + b^2",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(bracket, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "\\[".',
    );
  });

  it("rejects a math delimiter left open by a blank line", () => {
    const paren = [
      "\\begin{document}",
      "Before \\(a",
      "",
      "b\\)",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(paren, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "\\(".',
    );
    const bracket = [
      "\\begin{document}",
      "\\[a",
      "",
      "b\\]",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(bracket, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "\\[".',
    );
  });

  it("rejects an unpaired display math delimiter instead of escaping it", () => {
    const inline = [
      "\\begin{document}",
      "Before $$F=ma",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(inline, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "$$".',
    );
    const blankLine = [
      "\\begin{document}",
      "$$",
      "a",
      "",
      "b",
      "$$",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(blankLine, DEFAULT_SETTINGS)).toThrow(
      'Invalid LaTeX: unclosed math delimiter "$$".',
    );
  });

  it("accepts balanced and escaped math delimiters", () => {
    const source = [
      "\\begin{document}",
      "Inline \\(a^2 + b^2\\) and $c^2 + d^2$ and a literal \\$ sign.",
      "Display \\[e^2 + f^2\\].",
      "\\end{document}",
    ].join("\n");
    expect(() => latexToDocument(source, DEFAULT_SETTINGS)).not.toThrow();
  });

  it("keeps an escaped dollar inside dollar-delimited inline math", () => {
    const source = "\\begin{document}\nPrice $a\\$b$ today.\n\\end{document}";
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      "mathInline",
      "text",
    ]);
    expect(paragraph?.content?.[1]?.attrs).toEqual({ latex: "a\\$b" });
    expect(documentToLatex(parsed, settings)).toContain("Price \\(a\\$b\\) today.");
  });

  it("keeps a line break inside dollar-delimited inline math", () => {
    const source = "\\begin{document}\nCosts $a\n+ b$ total.\n\\end{document}";
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      "mathInline",
      "text",
    ]);
    expect(paragraph?.content?.[1]?.attrs).toEqual({ latex: "a\n+ b" });
    expect(documentToLatex(parsed, settings)).toContain("Costs \\(a\n+ b\\) total.");
  });

  it("imports hand-authored \\href as an editable link and re-exports it", () => {
    const source = [
      "\\begin{document}",
      "Before \\href{https://hand.example.org}{hand link} After",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      "text",
      "text",
    ]);
    expect(paragraph?.content?.[0]?.text).toBe("Before ");
    expect(paragraph?.content?.[1]?.text).toBe("hand link");
    expect(paragraph?.content?.[1]?.marks).toEqual([
      { type: "link", attrs: { href: "https://hand.example.org" } },
    ]);
    expect(paragraph?.content?.[2]?.text).toBe(" After");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain(
      "Before \\href{https://hand.example.org}{hand link} After",
    );
    expect(exported).not.toContain("\\textbackslash{}href");
  });

  it("imports hand-authored \\ref as an editable cross-reference and re-exports it", () => {
    const source = [
      "\\begin{document}",
      "Before \\href{https://hand.example.org}{hand link} and \\ref{sec:handwritten} then \\ref{fig:architecture} After",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      "text",
      "text",
      "crossReference",
      "text",
      "crossReference",
      "text",
    ]);
    expect(paragraph?.content?.[1]?.marks).toEqual([
      { type: "link", attrs: { href: "https://hand.example.org" } },
    ]);
    expect(paragraph?.content?.[3]?.attrs).toEqual({ label: "sec:handwritten" });
    expect(paragraph?.content?.[5]?.attrs).toEqual({ label: "fig:architecture" });
    expect(paragraph?.content?.[6]?.text).toBe(" After");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain(
      "Before \\href{https://hand.example.org}{hand link} and \\ref{sec:handwritten} then \\ref{fig:architecture} After",
    );
    expect(exported).not.toContain("\\textbackslash{}ref");
  });

  it("keeps escaped link URLs and nested marks through a LaTeX round trip", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Docs",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.org/a_b?x=1&y=2" } },
              ],
            },
          ],
        },
      ],
    };
    const expected = "\\href{https://example.org/a\\_b?x=1\\&y=2}{\\textbf{Docs}}";
    const latex = documentToLatex(document, settings);
    expect(latex).toContain(expected);
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    const marks = parsed.content[0]?.content?.[0]?.marks;
    expect(marks).toContainEqual({
      type: "link",
      attrs: { href: "https://example.org/a_b?x=1&y=2" },
    });
    expect(marks).toContainEqual({ type: "bold" });
    expect(documentToLatex(parsed, settings)).toContain(expected);
  });

  it("exports link addresses as typed so hyperref keeps the URL intact", () => {
    const hrefs = [
      "https://tilde.example.org/~user/page",
      "https://caret.example.org/a^b",
      "https://dollar.example.org/a$b",
      "https://back.example.org/a\\b",
    ];
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: hrefs.map((href, index) => ({
            type: "text",
            text: `word${index}`,
            marks: [{ type: "link", attrs: { href } }],
          })),
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    // The text escaper's \textasciitilde{}, \textasciicircum{} and \textdollar
    // forms leak into the PDF link annotation, so URL arguments skip them.
    expect(latex).toContain(
      "\\href{https://tilde.example.org/~user/page}{word0}",
    );
    expect(latex).toContain("\\href{https://caret.example.org/a^b}{word1}");
    expect(latex).toContain("\\href{https://dollar.example.org/a$b}{word2}");
    expect(latex).toContain(
      "\\href{https://back.example.org/a\\csname @backslashchar\\endcsname b}{word3}",
    );
    expect(latex).not.toContain("\\textasciitilde{}");
    expect(latex).not.toContain("\\textasciicircum{}");
    expect(latex).not.toContain("\\textbackslash{}");

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    for (const [index, href] of hrefs.entries()) {
      expect(parsed.content[0]?.content?.[index]?.marks).toContainEqual({
        type: "link",
        attrs: { href },
      });
    }
  });

  it("keeps a bracket that starts a list item as printed text", () => {
    const item = (text: string, listType: "bulletList" | "orderedList"): DocumentNode => ({
      type: listType,
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        },
      ],
    });
    const document: SentenceDocument = {
      type: "doc",
      content: [item("[draft] note", "bulletList"), item("[appendix] item", "orderedList")],
    };
    const latex = documentToLatex(document, settings);
    // Without the guard LaTeX reads `[draft]` as \item's optional label, which
    // replaces the bullet and drops the brackets from the printed text.
    expect(latex).toContain("\\item {[}draft] note");
    expect(latex).toContain("\\item {[}appendix] item");

    const parsed = latexToDocument(latex, settings).document;
    expect(parsed.content[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("[draft] note");
    expect(parsed.content[1]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("[appendix] item");
    expect(documentToLatex(parsed, settings)).toContain("\\item {[}draft] note");
  });

  it("round-trips nested lists through LaTeX source", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "renamed parent" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "keep child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const nestedLatex =
      "\\begin{itemize}\n\\item renamed parent\n\\begin{itemize}\n\\item keep child\n\\end{itemize}\n\\end{itemize}";
    const latex = documentToLatex(document, settings);
    expect(latex).toContain(nestedLatex);

    const parsed = latexToDocument(latex, settings).document;
    const list = parsed.content[0];
    expect(list?.type).toBe("bulletList");
    expect(list?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("renamed parent");
    const nested = list?.content?.[0]?.content?.[1];
    expect(nested?.type).toBe("bulletList");
    expect(nested?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("keep child");
    expect(documentToLatex(parsed, settings)).toContain(nestedLatex);
  });

  it("keeps two paragraphs of one list item as two paragraphs", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "outer" }] },
                { type: "paragraph", content: [{ type: "text", text: "inner one" }] },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        { type: "paragraph", content: [{ type: "text", text: "inner two" }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    // A single newline is a space in LaTeX, so the paragraphs need a blank line
    // between them or "outer" and "inner one" print as one paragraph.
    expect(latex).toContain(
      "\\begin{itemize}\n\\item outer\n\ninner one\n\\begin{itemize}\n\\item inner two\n\\end{itemize}\n\\end{itemize}",
    );

    const parsed = latexToDocument(latex, settings).document;
    const item = parsed.content[0]?.content?.[0];
    expect(item?.content?.map((child) => child.type)).toEqual(["paragraph", "paragraph", "bulletList"]);
    expect(item?.content?.[1]?.content?.[0]?.text).toBe("inner one");
    expect(documentToLatex(parsed, settings)).toContain("\\item outer\n\ninner one");
  });

  it("exports ordered list start numbers and round-trips them", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "apple" }] },
                {
                  type: "orderedList",
                  attrs: { start: 5 },
                  content: [
                    {
                      type: "listItem",
                      content: [
                        { type: "paragraph", content: [{ type: "text", text: "nested" }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const expected =
      "\\begin{enumerate}\n\\setcounter{enumi}{2}\n\\item apple\n\\begin{enumerate}\n\\setcounter{enumii}{4}\n\\item nested\n\\end{enumerate}\n\\end{enumerate}";
    const latex = documentToLatex(document, settings);
    expect(latex).toContain(expected);

    const parsed = latexToDocument(latex, settings).document;
    const list = parsed.content[0];
    expect(list?.type).toBe("orderedList");
    expect(list?.attrs?.start).toBe(3);
    const nested = list?.content?.[0]?.content?.[1];
    expect(nested?.type).toBe("orderedList");
    expect(nested?.attrs?.start).toBe(5);
    expect(documentToLatex(parsed, settings)).toContain(expected);
  });

  it("imports hand-authored mixed nested lists without flattening them", () => {
    const latex = [
      "\\begin{document}",
      "\\begin{itemize}",
      "\\item outer bullet",
      "",
      "\\begin{enumerate}",
      "\\item inner number one",
      "\\item inner number two",
      "\\end{enumerate}",
      "",
      "\\end{itemize}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS).document;
    const list = parsed.content[0];
    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(1);
    expect(list?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("outer bullet");
    const nested = list?.content?.[0]?.content?.[1];
    expect(nested?.type).toBe("orderedList");
    expect(nested?.content?.map((item) => item.content?.[0]?.content?.[0]?.text)).toEqual([
      "inner number one",
      "inner number two",
    ]);
    expect(documentToLatex(parsed, settings)).toContain(
      "\\begin{itemize}\n\\item outer bullet\n\\begin{enumerate}\n\\item inner number one\n\\item inner number two\n\\end{enumerate}\n\\end{itemize}",
    );
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

  it("imports display math inside an aligned wrapper as an aligned math block", () => {
    const source = [
      "\\begin{document}",
      "\\begin{center}",
      "\\begin{equation}",
      "E=mc^2",
      "\\end{equation}",
      "\\end{center}",
      "",
      "\\begin{flushleft}",
      "\\[",
      "F=ma",
      "\\]",
      "\\end{flushleft}",
      "",
      "\\begin{flushright}",
      "$$",
      "G=mg",
      "$$",
      "\\end{flushright}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "mathBlock",
      "mathBlock",
      "mathBlock",
    ]);
    expect(parsed.content[0]?.attrs).toMatchObject({
      latex: "E=mc^2",
      numbered: true,
      textAlign: "center",
    });
    expect(parsed.content[1]?.attrs).toMatchObject({
      latex: "F=ma",
      numbered: false,
      textAlign: "left",
    });
    expect(parsed.content[2]?.attrs).toMatchObject({
      latex: "G=mg",
      numbered: false,
      textAlign: "right",
    });
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain(
      "\\begin{center}\n\\begin{equation}\nE=mc^2\n\\end{equation}\n\\end{center}",
    );
    expect(exported).toContain(
      "\\begin{flushleft}\n\\begin{equation*}\nF=ma\n\\end{equation*}\n\\end{flushleft}",
    );
    expect(exported).toContain(
      "\\begin{flushright}\n\\begin{equation*}\nG=mg\n\\end{equation*}\n\\end{flushright}",
    );
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("parses $...$ source as editable inline math and keeps it on export", () => {
    const source = [
      "\\begin{document}",
      "Inline $E=mc^2$ tail",
      "",
      "\\begin{equation*}",
      "a^2+b^2=c^2",
      "\\end{equation*}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const paragraph = parsed.content[0];
    expect(paragraph?.content?.map((node) => node.type)).toEqual([
      "text",
      "mathInline",
      "text",
    ]);
    expect(paragraph?.content?.[0]?.text).toBe("Inline ");
    expect(paragraph?.content?.[1]?.attrs?.latex).toBe("E=mc^2");
    expect(paragraph?.content?.[2]?.text).toBe(" tail");
    expect(parsed.content[1]?.type).toBe("mathBlock");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Inline \\(E=mc^2\\) tail");
    expect(exported).toContain("\\begin{equation*}\na^2+b^2=c^2\n\\end{equation*}");
  });

  it("normalises a blank line inside a display equation so the export still compiles", () => {
    const source = [
      "\\begin{document}",
      "",
      "\\begin{equation}",
      "a",
      "",
      "b",
      "\\end{equation}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0]?.type).toBe("mathBlock");
    expect(parsed.content[0]?.attrs).toEqual({ latex: "a\nb", numbered: true });
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{equation}\na\nb\n\\end{equation}");
    expect(exported).not.toMatch(/\\begin\{equation\}\n[\s\S]*\n[ \t]*\n[\s\S]*\\end\{equation\}/);
  });

  it("imports numbered equation environments as editable display math and keeps them numbered", () => {
    const source = [
      "\\begin{document}",
      "",
      "\\begin{equation}",
      "a^2+b^2=c^2",
      "\\end{equation}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0]?.type).toBe("mathBlock");
    expect(parsed.content[0]?.attrs).toEqual({ latex: "a^2+b^2=c^2", numbered: true });
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{equation}\na^2+b^2=c^2\n\\end{equation}");
    expect(exported).not.toContain("\\textbackslash{}begin");
  });

  it("imports a hand-written align environment as display math and keeps it on export", () => {
    const source = [
      "\\begin{document}",
      "",
      "\\begin{align}",
      "ZXALIGN a &= b + c \\\\",
      "d &= e",
      "\\end{align}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0]?.type).toBe("mathBlock");
    expect(parsed.content[0]?.attrs?.latex).toBe("ZXALIGN a &= b + c \\\\\nd &= e");
    expect(parsed.content[0]?.attrs?.environment).toBe("align");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{align}\nZXALIGN a &= b + c \\\\\nd &= e\n\\end{align}");
    expect(exported).not.toContain("\\textbackslash{}begin");
  });

  it("imports display math inside a quote and a list item as block math", () => {
    const source = [
      "\\begin{document}",
      "",
      "\\begin{quote}",
      "\\begin{equation*}",
      "q=1",
      "\\end{equation*}",
      "\\end{quote}",
      "",
      "\\begin{itemize}",
      "\\item Before",
      "\\begin{equation*}",
      "L=1",
      "\\end{equation*}",
      "\\end{itemize}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content[0]?.type).toBe("blockquote");
    expect(parsed.content[0]?.content?.map((node) => node.type)).toEqual(["mathBlock"]);
    expect(parsed.content[0]?.content?.[0]?.attrs).toEqual({ latex: "q=1", numbered: false });
    const item = parsed.content[1]?.content?.[0];
    expect(item?.content?.map((node) => node.type)).toEqual(["paragraph", "mathBlock"]);
    expect(item?.content?.[1]?.attrs).toEqual({ latex: "L=1", numbered: false });
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{quote}\n\\begin{equation*}\nq=1\n\\end{equation*}\n\\end{quote}");
    expect(exported).toContain("\\item Before\n\\begin{equation*}\nL=1\n\\end{equation*}");
    expect(exported).not.toContain("\\textbackslash{}begin");
  });

  it("imports bracket, dollar and single-line equation display math as math blocks", () => {
    const source = [
      "\\begin{document}",
      "",
      "\\[ ZXBRACKET E = mc^2 \\]",
      "",
      "$$ ZXDOLLAR E = mc^2 $$",
      "",
      "\\begin{equation}ZXONELINE E = mc^2\\end{equation}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "mathBlock",
      "mathBlock",
      "mathBlock",
    ]);
    expect(parsed.content.map((node) => node.attrs?.latex)).toEqual([
      "ZXBRACKET E = mc^2",
      "ZXDOLLAR E = mc^2",
      "ZXONELINE E = mc^2",
    ]);
    expect(parsed.content.map((node) => node.attrs?.numbered)).toEqual([false, false, true]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{equation*}\nZXBRACKET E = mc^2\n\\end{equation*}");
    expect(exported).toContain("\\begin{equation*}\nZXDOLLAR E = mc^2\n\\end{equation*}");
    expect(exported).toContain("\\begin{equation}\nZXONELINE E = mc^2\n\\end{equation}");
    expect(exported).not.toContain("\\textbackslash{}[");
    expect(exported).not.toContain("\\$\\$");
  });

  it("imports display math inside running paragraph text as a block", () => {
    const source = [
      "\\begin{document}",
      "",
      "Before $$ZXINLINE F=ma$$ after.",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "paragraph",
      "mathBlock",
      "paragraph",
    ]);
    expect(parsed.content[1]?.attrs).toEqual({ latex: "ZXINLINE F=ma", numbered: false });
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Before\n\n\\begin{equation*}\nZXINLINE F=ma\n\\end{equation*}\n\nafter.");
    expect(exported).not.toContain("\\$\\$");
  });

  it("keeps escaped dollar signs as literal text", () => {
    const source = "\\begin{document}\nCosts \\$5 and \\$10.\n\\end{document}";
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content[0]?.content?.map((node) => node.type)).toEqual(["text"]);
    expect(parsed.content[0]?.content?.[0]?.text).toBe("Costs $5 and $10.");
    expect(documentToLatex(parsed, settings)).toContain("Costs \\$5 and \\$10.");
  });

  it("imports a spanning \\multicolumn header instead of storing it as text", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\hline",
      "\\multicolumn{2}{c}{ZXMULTI HEADER} \\\\",
      "ZXMULTI A & B \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content?.[0]?.content).toHaveLength(1);
    expect(table?.content?.[0]?.content?.[0]?.attrs).toEqual({ align: "center", colspan: 2 });
    expect(
      table?.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text,
    ).toBe("ZXMULTI HEADER");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\multicolumn{2}{c}{ZXMULTI HEADER} \\\\");
    expect(exported).toContain("ZXMULTI A & B \\\\");
    expect(exported).not.toContain("textbackslash");
  });

  it("keeps the header row when importing table LaTeX", () => {
    const cells = [
      ["H1", "H2", "H3", "H4"],
      ["a1", "a2", "a3", "a4"],
      ["b1", "b2", "b3", "b4"],
      ["c1", "c2", "c3", "c4"],
    ];
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{llll}",
      "\\hline",
      ...cells.map((row) => `${row.join(" & ")} \\\\`),
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(4);
    expect(table?.content?.[0]?.content?.map((cell) => cell.type)).toEqual([
      "tableHeader",
      "tableHeader",
      "tableHeader",
      "tableHeader",
    ]);
    expect(
      table?.content?.[0]?.content?.map(
        (cell) => cell.content?.[0]?.content?.[0]?.text,
      ),
    ).toEqual(["H1", "H2", "H3", "H4"]);
    const exported = documentToLatex(parsed, settings);
    for (const row of cells) {
      expect(exported).toContain(`${row.join(" & ")} \\\\`);
    }
  });

  it("keeps empty rows in a one-column table through a source round trip", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{l}",
      "\\hline",
      "Head \\\\",
      " \\\\",
      " \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0]?.content?.[0]?.type).toBe("tableHeader");
    for (const row of table?.content ?? []) {
      expect(row.content).toHaveLength(1);
    }
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Head \\\\\n \\\\\n \\\\");
  });

  it("imports a single empty cell as a 1x1 table instead of body text", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{l}",
      "\\hline",
      " \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(1);
    expect(table?.content?.[0]?.content).toHaveLength(1);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{l}\n\\hline\n \\\\\n\\hline");
    expect(exported).not.toContain("textbackslash");
  });

  it("keeps a hand-written table label so its \\ref still resolves", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\caption{ZXCAPTION}",
      "\\label{tab:zxtable}",
      "\\begin{tabular}{ll}",
      "\\hline",
      "Name & Value \\\\",
      "ZXTABLELABEL & 7 \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "",
      "See Table~\\ref{tab:zxtable}.",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.attrs).toEqual({ caption: "ZXCAPTION", label: "tab:zxtable" });
    expect(table?.content).toHaveLength(2);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\caption{ZXCAPTION}\n\\label{tab:zxtable}");
    expect(exported).toContain("ZXTABLELABEL & 7 \\\\");
    expect(exported).toContain("\\ref{tab:zxtable}");
    expect(exported).not.toContain("textbackslash");
  });

  it("imports rows that end with row-spacing arguments like \\\\[4pt]", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\hline",
      "Name & Value \\\\[4pt]",
      "ZXSPACED & 77 \\\\[4pt]",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(2);
    expect(
      table?.content?.map((row) =>
        row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
      ),
    ).toEqual([
      ["Name", "Value"],
      ["ZXSPACED", "77"],
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Name & Value \\\\\n");
    expect(exported).toContain("ZXSPACED & 77 \\\\\n");
    expect(exported).not.toContain("textbackslash");
  });

  it("keeps the closing \\hline out of a last row with no row break", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\hline",
      "Name & Value \\\\",
      "ZXLASTROW & 99",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(2);
    expect(
      table?.content?.map((row) =>
        row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
      ),
    ).toEqual([
      ["Name", "Value"],
      ["ZXLASTROW", "99"],
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("ZXLASTROW & 99 \\\\\n");
    expect(exported).not.toContain("textbackslash");
  });

  it("keeps a Shift+Enter line break inside a table cell", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "one" },
                        { type: "hardBreak" },
                        { type: "text", text: "two" },
                      ],
                    },
                  ],
                },
                { type: "tableHeader", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    // A bare \\ here would end the tabular row instead of breaking the line.
    expect(latex).toContain("\\shortstack[l]{one\\\\two} &  \\\\");
    const parsed = latexToDocument(latex, settings).document;
    const table = parsed.content[0];
    expect(table?.content).toHaveLength(1);
    expect(table?.content?.[0]?.content).toHaveLength(2);
    expect(
      table?.content?.[0]?.content?.[0]?.content?.[0]?.content?.map((node) => node.type),
    ).toEqual(["text", "hardBreak", "text"]);
    expect(documentToLatex(parsed, settings)).toContain("\\shortstack[l]{one\\\\two}");
  });

  it("imports a single-row tabular that has no row break at all", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\hline",
      "Name & Value",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(1);
    expect(
      table?.content?.[0]?.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
    ).toEqual(["Name", "Value"]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("Name & Value \\\\\n");
    expect(exported).not.toContain("textbackslash");
  });

  it("imports a braced table column spec without leaking it into the first cell", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\caption{ZXPCOLCAP}",
      "\\begin{tabular}{p{4cm}l}",
      "\\hline",
      "ZXPCOLNAME & Value \\\\",
      "ZXPCOLCELL & 9 \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(
      table?.content?.map((row) =>
        row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
      ),
    ).toEqual([
      ["ZXPCOLNAME", "Value"],
      ["ZXPCOLCELL", "9"],
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{ll}");
    expect(exported).not.toContain("l\\}");
  });

  it("imports a table column spec with @{} rules without corrupting the first cell", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\begin{tabular}{@{}ll@{}}",
      "\\hline",
      "ZXATSPEC & 12 \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(
      table?.content?.map((row) =>
        row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
      ),
    ).toEqual([["ZXATSPEC", "12"]]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{ll}");
    expect(exported).not.toContain("ll@");
  });

  it("keeps a table without a header row through a source round trip", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("% Sentence table header: none");
    const parsed = latexToDocument(latex, settings).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content?.[0]?.content?.map((cell) => cell.type)).toEqual([
      "tableCell",
      "tableCell",
    ]);
    expect(table?.content?.[1]?.content?.map((cell) => cell.type)).toEqual([
      "tableCell",
      "tableCell",
    ]);
    expect(documentToLatex(parsed, settings)).toContain("% Sentence table header: none");
    expect(documentToLatex(parsed, settings)).not.toContain("\\textbackslash{}% Sentence");
  });

  it("recognizes block commands placed directly after text without a blank line", () => {
    const source = [
      "\\begin{document}",
      "TIGHT paragraph before a section",
      "\\section{TIGHT SECTION}",
      "TIGHT section body",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "TIGHT & 9 \\\\",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "paragraph",
      "heading",
      "paragraph",
      "table",
    ]);
    expect(parsed.content[1]?.content?.[0]?.text).toBe("TIGHT SECTION");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\section{TIGHT SECTION}");
    expect(exported).toContain("\\begin{tabular}{ll}");
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("keeps a section label off the heading text and back in the source", () => {
    const source = [
      "\\begin{document}",
      "\\section{ZXLABEL SECTION}\\label{sec:zxlabel}",
      "",
      "ZXLABEL BODY",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const heading = parsed.content[0];
    expect(heading?.type).toBe("heading");
    expect(heading?.attrs).toEqual({ level: 1, label: "sec:zxlabel" });
    expect(heading?.content?.map((node) => node.text).join("")).toBe("ZXLABEL SECTION");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\section{ZXLABEL SECTION}\\label{sec:zxlabel}");
    expect(exported).not.toContain("\\textbackslash{}label");
  });

  it("keeps a section label on the line after the heading", () => {
    const source = [
      "\\begin{document}",
      "\\section{ZXSEPLABEL}",
      "\\label{sec:seplabel}",
      "",
      "ZXSEP BODY",
      "",
      "See \\ref{sec:seplabel}.",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const heading = parsed.content[0];
    expect(heading?.type).toBe("heading");
    expect(heading?.attrs).toEqual({ level: 1, label: "sec:seplabel" });
    expect(heading?.content?.map((node) => node.text).join("")).toBe("ZXSEPLABEL");
    expect(parsed.content.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\section{ZXSEPLABEL}\\label{sec:seplabel}");
    expect(exported).toContain("\\ref{sec:seplabel}");
    expect(exported).not.toContain("\\textbackslash{}label");
  });

  it("keeps a starred section unnumbered instead of escaping its command", () => {
    const source = [
      "\\begin{document}",
      "\\section*{ZXSTAR SECTION}",
      "",
      "ZXSTAR BODY",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const heading = parsed.content[0];
    expect(heading?.type).toBe("heading");
    expect(heading?.attrs).toEqual({ level: 1, unnumbered: true });
    expect(parsed.content[1]?.content?.map((node) => node.text).join("")).toBe("ZXSTAR BODY");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\section*{ZXSTAR SECTION}");
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("keeps the short title of a section out of the heading text and in the source", () => {
    const source = [
      "\\begin{document}",
      "\\section[ZXSHORT]{ZXOPT FULL TITLE}",
      "",
      "ZXOPT BODY",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const heading = parsed.content[0];
    expect(heading?.type).toBe("heading");
    expect(heading?.attrs).toEqual({ level: 1, shortTitle: "ZXSHORT" });
    expect(heading?.content?.map((node) => node.text).join("")).toBe("ZXOPT FULL TITLE");
    expect(parsed.content[1]?.content?.map((node) => node.text).join("")).toBe("ZXOPT BODY");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\section[ZXSHORT]{ZXOPT FULL TITLE}");
    expect(exported).not.toContain("\\textbackslash{}");
  });

  it("imports a list followed by text without a blank line", () => {
    const source = [
      "\\begin{document}",
      "\\begin{itemize}",
      "\\item a",
      "\\item b",
      "\\end{itemize}",
      "Following paragraph",
      "\\begin{enumerate}",
      "\\item one",
      "\\end{enumerate}",
      "After numbered list",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    expect(parsed.content.map((node) => node.type)).toEqual([
      "bulletList",
      "paragraph",
      "orderedList",
      "paragraph",
    ]);
    expect(parsed.content[0]?.content).toHaveLength(2);
    expect(parsed.content[1]?.content?.[0]?.text).toBe("Following paragraph");
    expect(parsed.content[3]?.content?.[0]?.text).toBe("After numbered list");
    const between = latexToDocument(
      [
        "\\begin{document}",
        "\\begin{itemize}",
        "\\item a",
        "\\end{itemize}",
        "Between the lists",
        "\\begin{itemize}",
        "\\item c",
        "\\end{itemize}",
        "\\end{document}",
      ].join("\n"),
      DEFAULT_SETTINGS,
    ).document;
    expect(between.content.map((node) => node.type)).toEqual([
      "bulletList",
      "paragraph",
      "bulletList",
    ]);
    expect(between.content[1]?.content?.[0]?.text).toBe("Between the lists");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{itemize}");
    expect(exported).toContain("\\begin{enumerate}");
    expect(exported).not.toContain("\\textbackslash{}begin");
  });

  it("keeps escaped ampersands inside table cells on import", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{lll}",
      "\\hline",
      "Header! &  &  \\\\",
      "R\\&D &  &  \\\\",
      " &  &  \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.map((row) => row.content?.length)).toEqual([3, 3, 3]);
    expect(table?.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("Header!");
    expect(table?.content?.[1]?.content?.[0]?.content?.[0]?.content?.[0]?.text).toBe("R&D");
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{lll}");
    expect(exported).toContain("R\\&D &  &  \\\\");
  });

  it("imports a booktabs-ruled table as its rows instead of rule text", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{ll}",
      "\\toprule",
      "Name & Value \\\\",
      "\\midrule",
      "ZXBOOK & 55 \\\\",
      "\\bottomrule",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content?.map((row) => row.content?.length)).toEqual([2, 2]);
    expect(
      table?.content?.map((row) =>
        row.content?.map((cell) => cell.content?.[0]?.content?.[0]?.text),
      ),
    ).toEqual([
      ["Name", "Value"],
      ["ZXBOOK", "55"],
    ]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{ll}");
    expect(exported).toContain("Name & Value \\\\\nZXBOOK & 55 \\\\");
    expect(exported).not.toContain("\\textbackslash{}toprule");
    expect(exported).not.toContain("\\textbackslash{}midrule");
  });

  it("imports a single-column tabular as a table and re-exports the environment", () => {
    const source = [
      "\\begin{document}",
      "\\begin{table}[htbp]",
      "\\centering",
      "\\begin{tabular}{l}",
      "\\hline",
      "Only \\\\",
      "a \\\\",
      "b \\\\",
      "\\hline",
      "\\end{tabular}",
      "\\end{table}",
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const table = parsed.content[0];
    expect(table?.type).toBe("table");
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.map((row) => row.content?.length)).toEqual([1, 1, 1]);
    expect(
      table?.content?.map((row) => row.content?.[0]?.content?.[0]?.content?.[0]?.text),
    ).toEqual(["Only", "a", "b"]);
    const exported = documentToLatex(parsed, settings);
    expect(exported).toContain("\\begin{tabular}{l}");
    expect(exported).toContain("Only \\\\\na \\\\\nb \\\\");
    expect(exported).not.toContain("\\textbackslash{}begin");
  });

  it("exports every paragraph of a table cell and restores them on import", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "first line" }] },
                    { type: "paragraph", content: [{ type: "text", text: "second line" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("H \\\\\nfirst line\\par second line \\\\");
    const parsed = latexToDocument(latex, settings).document;
    const cell = parsed.content[0]?.content?.[1]?.content?.[0];
    expect(cell?.content?.map((node) => node.type)).toEqual(["paragraph", "paragraph"]);
    expect(cell?.content?.map((node) => node.content?.[0]?.text)).toEqual([
      "first line",
      "second line",
    ]);
    expect(documentToLatex(parsed, settings)).toContain("first line\\par second line \\\\");
  });

  it("exports a block image inside a table cell as an inline graphic", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Cell" }] },
                    {
                      type: "image",
                      attrs: { path: "assets/images/cell.png", alt: "cell image" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).not.toContain("\\begin{figure}");
    expect(latex).toContain(
      "Cell\\par \\includegraphics{assets/images/cell.png}% Sentence alt: cell image",
    );
  });

  it("exports a caption on an image inside a table cell with its graphic", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "image",
                      attrs: {
                        path: "assets/images/cell.png",
                        alt: "cell image",
                        caption: "CELL CAPTION",
                        naturalWidth: 120,
                        naturalHeight: 60,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\usepackage{caption}");
    expect(latex).not.toContain("\\caption{CELL CAPTION}");
    expect(latex).toContain(
      [
        "\\begin{minipage}{90.00bp}",
        "\\centering",
        "\\includegraphics[width=90.00bp]{assets/images/cell.png}% Sentence alt: cell image",
        "\\captionof{figure}{CELL CAPTION}",
        "\\end{minipage}",
      ].join("\n"),
    );
  });

  it("round-trips a caption on an image inside a table cell", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "image",
                      attrs: {
                        path: "assets/images/cell.png",
                        alt: "cell image",
                        caption: "CELL CAPTION",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    const { document: parsed } = latexToDocument(latex, settings);
    const image = parsed.content?.[0]?.content?.[0]?.content?.[0]?.content?.[0];
    expect(image?.type).toBe("image");
    expect(image?.attrs?.caption).toBe("CELL CAPTION");
    expect(image?.attrs?.alt).toBe("cell image");
    expect(documentToLatex(parsed, settings)).toBe(latex);
  });

  it("exports a block equation inside a table cell as display-style inline math", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Cell" }] },
                    { type: "mathBlock", attrs: { latex: "x^2+y^2=z^2", numbered: false } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).not.toContain("\\begin{equation");
    expect(latex).toContain("Cell\\par \\(\\displaystyle x^2+y^2=z^2\\) \\\\");
    const parsed = latexToDocument(latex, settings).document;
    const cell = parsed.content[0]?.content?.[1]?.content?.[0];
    expect(cell?.content?.map((node) => node.type)).toEqual(["paragraph", "mathBlock"]);
    expect(cell?.content?.[1]?.attrs?.latex).toBe("x^2+y^2=z^2");
    expect(documentToLatex(parsed, settings)).toBe(latex);
  });

  it("keeps an inline equation in a table cell inline on import", () => {
    const parsed = latexToDocument(
      [
        "\\begin{document}",
        "\\begin{table}[htbp]",
        "\\centering",
        "% Sentence table header: none",
        "\\begin{tabular}{ll}",
        "\\hline",
        "a & b \\\\",
        "c & \\(x^2+y^2=z^2\\) \\\\",
        "\\hline",
        "\\end{tabular}",
        "\\end{table}",
        "\\end{document}",
      ].join("\n"),
      settings,
    ).document;
    const cell = parsed.content[0]?.content?.[1]?.content?.[1];
    expect(cell?.content?.[0]?.content?.[0]?.type).toBe("mathInline");
  });

  it("sizes a measured image inside a table cell like the block it is in the page", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "image",
                      attrs: {
                        path: "assets/images/cell.png",
                        naturalWidth: 120,
                        naturalHeight: 60,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\includegraphics[width=90.00bp]{assets/images/cell.png}");
    expect(latex).not.toContain("width=0.8\\linewidth");
  });

  it("sizes an oversized image inside a table cell to the cell, not the text block", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph" },
                    {
                      type: "image",
                      attrs: {
                        path: "assets/images/wide-cell.png",
                        naturalWidth: 2400,
                        naturalHeight: 600,
                      },
                    },
                  ],
                },
                { type: "tableCell", content: [{ type: "paragraph" }] },
                { type: "tableCell", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    // Three columns put six \tabcolsep into the tabular. Sizing the graphic to
    // the text block makes the table overrun the margin by exactly that
    // padding, so the width has to leave room for it.
    expect(latex).toContain(
      "\\includegraphics[width=\\dimexpr\\linewidth-6\\tabcolsep\\relax,height=\\textheight,keepaspectratio]{assets/images/wide-cell.png}",
    );
    expect(latex).toContain("\\begin{tabular}{lll}");
    expect(latex).not.toContain("width=\\linewidth");
    const parsed = latexToDocument(latex, settings).document;
    expect(parsed.content[0]?.type).toBe("table");
  });

  it("round-trips a table caption through LaTeX", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          attrs: { caption: "Results & discussion" },
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\caption{Results \\& discussion}");
    const parsed = latexToDocument(latex, settings).document;
    expect(parsed.content[0]?.attrs?.caption).toBe("Results & discussion");
    expect(documentToLatex(parsed, settings)).toContain("\\caption{Results \\& discussion}");
  });

  it("keeps escaped braces in a table caption through LaTeX", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          attrs: { caption: "R&D 50% {x}" },
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\caption{R\\&D 50\\% \\{x\\}}");
    const parsed = latexToDocument(`${latex}\n% check\n`, settings).document;
    expect(parsed.content[0]?.attrs?.caption).toBe("R&D 50% {x}");
    expect(documentToLatex(parsed, settings)).toContain("\\caption{R\\&D 50\\% \\{x\\}}");
  });

  it("round-trips cell alignment through LaTeX column specs", () => {
    const header = (align?: string): DocumentNode => ({
      type: "tableHeader",
      ...(align ? { attrs: { align } } : {}),
      content: [{ type: "paragraph", content: [{ type: "text", text: align ?? "plain" }] }],
    });
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            { type: "tableRow", content: [header("center"), header()] },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { align: "right" },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\begin{tabular}{cl}");
    expect(latex).toContain("\\multicolumn{1}{r}{a}");
    const parsed = latexToDocument(latex, settings).document;
    expect(parsed.content[0]?.content?.[0]?.content?.[0]?.attrs?.align).toBe("center");
    expect(parsed.content[0]?.content?.[1]?.content?.[0]?.attrs?.align).toBe("right");
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

  it("round-trips inserted tables of contents without duplicating the generated one", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before." }] },
        { type: "toc" },
        { type: "paragraph", content: [{ type: "text", text: "After." }] },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("Before.\n\n\\tableofcontents\n\nAfter.");
    const parsed = latexToDocument(latex, settings);
    expect(parsed.document.content.map((node) => node.type)).toEqual([
      "paragraph",
      "toc",
      "paragraph",
    ]);
    expect(documentToLatex(parsed.document, parsed.settings)).toBe(latex);

    const withGeneratedToc = documentToLatex(document, {
      ...settings,
      includeToc: true,
    });
    // The placed block represents the contents, so the generated one must not
    // add a second \tableofcontents and a second contents page.
    expect(withGeneratedToc.match(/\\tableofcontents/g)).toHaveLength(1);
    const generatedParsed = latexToDocument(withGeneratedToc, {
      ...settings,
      includeToc: true,
    });
    expect(generatedParsed.document.content.map((node) => node.type)).toEqual([
      "paragraph",
      "toc",
      "paragraph",
    ]);
    expect(documentToLatex(generatedParsed.document, generatedParsed.settings)).toBe(
      withGeneratedToc,
    );
  });

  it("generates one contents page when the document has no placed table of contents", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Intro" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body." }] },
      ],
    };
    const latex = documentToLatex(document, { ...settings, includeToc: true });
    expect(latex.match(/\\tableofcontents/g)).toHaveLength(1);
    expect(latex).toContain("\\tableofcontents\\newpage");
    const parsed = latexToDocument(latex, { ...settings, includeToc: true });
    expect(parsed.document.content.map((node) => node.type)).toEqual(["heading", "paragraph"]);
    expect(documentToLatex(parsed.document, parsed.settings)).toBe(latex);
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
    // Space after applies in both modes, so indent mode still sets \parskip.
    expect(plain).toContain("\\setlength{\\parskip}");
    expect(plain).not.toContain("\\usepackage{parskip}");
    const plainParsed = latexToDocument(plain, DEFAULT_SETTINGS);
    expect(plainParsed.settings.fontFamily).toBe("default");
    expect(plainParsed.settings.lineSpacing).toBe("single");
    expect(plainParsed.settings.paragraphSpacing).toBe("indent");
  });

  it("emits and round-trips two-column layout", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Two columns." }] },
      ],
    };
    const twoColumn: ProjectSettings = { ...settings, columns: "two" };
    const latex = documentToLatex(document, twoColumn);
    expect(latex).toContain("\\documentclass[11pt,a4paper,twocolumn]{article}");
    expect(latexToDocument(latex, DEFAULT_SETTINGS).settings.columns).toBe("two");

    const singleColumn = documentToLatex(document, { ...settings, columns: "one" });
    expect(singleColumn).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(singleColumn).not.toContain("twocolumn");
    expect(latexToDocument(singleColumn, DEFAULT_SETTINGS).settings.columns).toBe("one");
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

  it("loads xcolor when a formula uses a colour command", () => {
    const latex = documentToLatex(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Colour " },
              { type: "mathInline", attrs: { latex: "\\textcolor{red}{x}" } },
            ],
          },
          { type: "mathBlock", attrs: { latex: "\\color{blue} y = 1" } },
        ],
      },
      DEFAULT_SETTINGS,
    );
    expect(latex).toContain("\\usepackage{xcolor}");
    expect(latex).toContain("\\(\\textcolor{red}{x}\\)");

    const plainLatex = documentToLatex(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "mathInline", attrs: { latex: "\\textcolorful{y}" } }],
          },
        ],
      },
      DEFAULT_SETTINGS,
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

  it("writes image asset paths instead of base64 data URIs", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            alt: "qa test.png",
          },
        },
        {
          type: "image",
          attrs: {
            src: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            path: "assets/images/imported-qa-test.png",
            alt: "qa-test.png",
          },
        },
        {
          type: "image",
          attrs: { src: "data:image/png;base64,iVBORw0KGgo==", alt: "" },
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("{assets/images/qa-test.png}");
    expect(latex).toContain("{assets/images/imported-qa-test.png}");
    expect(latex).toContain("{assets/images/image.png}");
    expect(latex).not.toContain("data:");
  });

  it("gives an image a free asset path when its file name is already used", () => {
    expect(uniqueImageAssetPath("qa image #1.png", [])).toBe("assets/images/qa-image--1.png");
    expect(
      uniqueImageAssetPath("qa image #1.png", ["assets/images/qa-image--1.png"]),
    ).toBe("assets/images/qa-image--1-2.png");
    expect(
      uniqueImageAssetPath("qa image #1.png", [
        "assets/images/qa-image--1.png",
        "assets/images/qa-image--1-2.png",
      ]),
    ).toBe("assets/images/qa-image--1-3.png");
    expect(uniqueImageAssetPath("photo.jpeg", ["assets/images/photo.png"])).toBe(
      "assets/images/photo.jpeg",
    );
  });

  it("keeps two images with the same file name apart across a source round trip", () => {
    const red = "data:image/png;base64,red";
    const blue = "data:image/png;base64,blue";
    const document: SentenceDocument = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: red, alt: "qa image #1.png", path: "assets/images/qa-image--1.png" } },
        {
          type: "image",
          attrs: { src: blue, alt: "qa image #1.png", path: "assets/images/qa-image--1-2.png" },
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("{assets/images/qa-image--1.png}");
    expect(latex).toContain("{assets/images/qa-image--1-2.png}");
    const restored = restoreImageSources(
      latexToDocument(latex, DEFAULT_SETTINGS).document,
      document,
    );
    expect(restored.content[0].attrs?.src).toBe(red);
    expect(restored.content[1].attrs?.src).toBe(blue);
  });

  it("writes only a caption the user wrote, never the image file name", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { path: "assets/images/qa-image--1.png", alt: "qa image #1.png" },
        },
        {
          type: "image",
          attrs: {
            path: "assets/images/qa-image--1.png",
            alt: "qa image #1.png",
            caption: "Architecture & flow",
          },
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).not.toContain("\\caption{qa image");
    expect(latex).toContain("\\caption{Architecture \\& flow}");

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.document.content[1].attrs?.caption).toBe("Architecture & flow");
    expect(documentToLatex(parsed.document, settings)).toBe(latex);
  });

  it("keeps an image alt text across a source round trip", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { path: "assets/images/qa-image--1.png", alt: "qa image #1.png" },
        },
        {
          type: "image",
          attrs: {
            path: "assets/images/photo.png",
            alt: "photo.png",
            caption: "Architecture & flow",
          },
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("% Sentence alt: qa image #1.png");
    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.document.content[0].attrs?.alt).toBe("qa image #1.png");
    expect(parsed.document.content[1].attrs?.alt).toBe("photo.png");
    expect(parsed.document.content[1].attrs?.caption).toBe("Architecture & flow");
    expect(documentToLatex(parsed.document, settings)).toBe(latex);
  });

  it("exports an inserted image at the size the page shows", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            path: "assets/images/tiny.png",
            naturalWidth: 40,
            naturalHeight: 80,
          },
        },
      ],
    };
    // 40 CSS pixels at 96 dpi are 30bp: the size the editor renders.
    expect(documentToLatex(document, settings)).toContain(
      "\\includegraphics[width=30.00bp]{assets/images/tiny.png}",
    );
  });

  it("caps an oversized image to the text block and the page height", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            path: "assets/images/wide.png",
            naturalWidth: 2400,
            naturalHeight: 1600,
          },
        },
      ],
    };
    expect(documentToLatex(document, settings)).toContain(
      "\\includegraphics[width=\\linewidth,height=\\textheight,keepaspectratio]{assets/images/wide.png}",
    );
  });

  it("keeps an inline image inside a heading and its title intact", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "text", text: "Draf" },
            {
              type: "inlineImage",
              attrs: {
                path: "assets/images/icon.png",
                alt: "icon.png",
                naturalWidth: 120,
                naturalHeight: 60,
              },
            },
            { type: "text", text: "ting with constraints" },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain("\\subsection{Draf\\includegraphics");

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.document.content).toHaveLength(1);
    const heading = parsed.document.content[0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs?.level).toBe(2);
    const image = heading.content?.find((node) => node.type === "inlineImage");
    expect(image?.attrs?.path).toBe("assets/images/icon.png");
    expect(image?.attrs?.alt).toBe("icon.png");
    expect(
      heading.content
        ?.filter((node) => node.type === "text")
        .map((node) => node.text)
        .join(""),
    ).toBe("Drafting with constraints");
    expect(documentToLatex(parsed.document, settings)).toContain("\\subsection{Draf");
  });

  it("keeps an inline image inside its paragraph", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "SPLIT BEFORE." },
            {
              type: "inlineImage",
              attrs: {
                src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
                alt: "mid paragraph.png",
                path: "assets/images/mid-paragraph.png",
              },
            },
            { type: "text", text: " SPLIT AFTER." },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).not.toContain("\\begin{figure}");
    expect(latex).toContain(
      "SPLIT BEFORE.\\includegraphics[height=1.5em]{assets/images/mid-paragraph.png}% Sentence alt: mid paragraph.png\n SPLIT AFTER.",
    );

    const parsed = latexToDocument(latex, DEFAULT_SETTINGS);
    expect(parsed.document.content).toHaveLength(1);
    const paragraph = parsed.document.content[0];
    expect(paragraph.type).toBe("paragraph");
    const image = paragraph.content?.find((node) => node.type === "inlineImage");
    expect(image?.attrs?.path).toBe("assets/images/mid-paragraph.png");
    expect(image?.attrs?.alt).toBe("mid paragraph.png");
    expect(documentToLatex(parsed.document, settings)).toBe(latex);
  });

  it("sizes an inline image to the 1.5em line height it is drawn at", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "MID " },
            {
              type: "inlineImage",
              attrs: {
                path: "assets/images/mid.png",
                alt: "mid.png",
                naturalWidth: 40,
                naturalHeight: 80,
              },
            },
            { type: "text", text: " MID" },
          ],
        },
      ],
    };
    const latex = documentToLatex(document, settings);
    expect(latex).toContain(
      "MID \\includegraphics[width=\\linewidth,height=1.5em,keepaspectratio]{assets/images/mid.png}% Sentence alt: mid.png\n MID",
    );

    const small: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "inlineImage",
              attrs: { path: "assets/images/icon.png", naturalWidth: 10, naturalHeight: 10 },
            },
          ],
        },
      ],
    };
    expect(documentToLatex(small, settings)).toContain(
      "\\includegraphics[width=7.50bp]{assets/images/icon.png}",
    );
  });

  it("keeps packages and macros typed into the preamble through a sync", () => {
    const document: SentenceDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Before." }] }],
    };
    const base = documentToLatex(document, settings);
    const edited = base
      .replace(
        "\\begin{document}",
        "\\usepackage{amsthm}\n\\newcommand{\\ZXMACRO}{ZXMACRO EXPANDS}\n\\begin{document}",
      )
      .replace(
        "\\end{document}",
        "\nZXPREAMBLE use \\ZXMACRO{} here.\n\\end{document}",
      );

    const parsed = latexToDocument(edited, settings);
    // The macro call becomes the text it prints instead of an escaped literal.
    expect(documentPlainText(parsed.document)).toContain(
      "ZXPREAMBLE use ZXMACRO EXPANDS here.",
    );
    expect(parsed.settings.preamble).toContain("\\usepackage{amsthm}");
    expect(parsed.settings.preamble).toContain(
      "\\newcommand{\\ZXMACRO}{ZXMACRO EXPANDS}",
    );

    const regenerated = documentToLatex(parsed.document, parsed.settings);
    const preamble = regenerated.split("\\begin{document}")[0];
    expect(preamble).toContain("\\usepackage{amsthm}");
    expect(preamble).toContain("\\newcommand{\\ZXMACRO}{ZXMACRO EXPANDS}");
    expect(regenerated).not.toContain("\\textbackslash{}ZXMACRO");

    // A second round trip neither drops the lines nor duplicates them.
    const again = latexToDocument(regenerated, parsed.settings);
    expect(again.settings.preamble).toBe(parsed.settings.preamble);
    expect(documentToLatex(again.document, again.settings)).toBe(regenerated);
  });

  it("keeps a renderable source when a document is synchronized from LaTeX", () => {
    const previous: SentenceDocument = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
            path: "assets/images/qa-image--1.png",
            alt: "qa image #1.png",
            naturalWidth: 120,
            naturalHeight: 60,
          },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Mid " },
            {
              type: "inlineImage",
              attrs: {
                src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
                path: "assets/images/mid.png",
                alt: "mid.png",
              },
            },
          ],
        },
      ],
    };
    const parsed = latexToDocument(documentToLatex(previous, settings), DEFAULT_SETTINGS);
    expect(parsed.document.content[0].attrs?.src).toBe("assets/images/qa-image--1.png");
    const paragraph = parsed.document.content[1];
    expect(paragraph.content?.[1].attrs?.src).toBe("assets/images/mid.png");

    const restored = restoreImageSources(parsed.document, previous);
    expect(restored.content[0].attrs?.src).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");
    // The measure is not in the LaTeX, so the sync has to carry it over or the
    // figure would print at a different size after an apply.
    expect(restored.content[0].attrs?.naturalWidth).toBe(120);
    expect(restored.content[0].attrs?.naturalHeight).toBe(60);
    expect(restored.content[1].content?.[1].attrs?.src).toBe(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    );
    // The paths that LaTeX and the export pipeline rely on stay untouched.
    expect(restored.content[0].attrs?.path).toBe("assets/images/qa-image--1.png");
    expect(restored.content[1].content?.[1].attrs?.path).toBe("assets/images/mid.png");

    // A second synchronization starts from the restored document, so the
    // source paths still have to resolve to the same rendered images.
    const second = restoreImageSources(
      latexToDocument(documentToLatex(restored, settings), DEFAULT_SETTINGS).document,
      restored,
    );
    expect(second.content[0].attrs?.src).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");
    expect(second.content[1].content?.[1].attrs?.src).toBe(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    );
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

describe("paragraph spacing (Word-style points)", () => {
  const doc: SentenceDocument = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "One." }] }],
  };
  const base: ProjectSettings = { ...DEFAULT_SETTINGS, paragraphSpacing: "gap", paragraphSpaceAfter: 10 };

  it("emits parskip in points and no indent in gap mode", () => {
    const latex = documentToLatex(doc, base);
    expect(latex).toContain("\\setlength{\\parskip}{10.0pt plus 2pt}");
    expect(latex).not.toContain("\\setlength{\\parindent}");
  });

  it("keeps the indent in indent mode and still honours Space after", () => {
    const latex = documentToLatex(doc, { ...base, paragraphSpacing: "indent", paragraphSpaceAfter: 24 });
    expect(latex).toContain("\\setlength{\\parskip}{24.0pt plus 2pt}");
    expect(latex).toContain("\\setlength{\\parindent}{1.5em}");
  });

  it("round-trips the Space after value", () => {
    const latex = documentToLatex(doc, { ...base, paragraphSpaceAfter: 18 });
    expect(latexToDocument(latex, DEFAULT_SETTINGS).settings.paragraphSpaceAfter).toBe(18);
  });
});

describe("per-paragraph spacing", () => {
  it("emits \\vspace* for one paragraph and parses it back onto that paragraph", () => {
    const doc: SentenceDocument = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First." }] },
        { type: "paragraph", attrs: { spaceAfter: 24 }, content: [{ type: "text", text: "Second." }] },
      ],
    };
    const latex = documentToLatex(doc, DEFAULT_SETTINGS);
    expect(latex).toContain("\\vspace*{24.0pt}");
    expect((latex.match(/\\vspace\*\{/g) ?? []).length).toBe(1);

    const back = latexToDocument(latex, DEFAULT_SETTINGS);
    const paragraphs = (back.document.content ?? []).filter((node) => node.type === "paragraph");
    expect(paragraphs[0]?.attrs?.spaceAfter ?? 0).toBe(0);
    expect(paragraphs[1]?.attrs?.spaceAfter).toBe(24);
  });
});
