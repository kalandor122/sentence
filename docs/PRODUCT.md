# Sentence — product definition

A desktop visual editor for LaTeX with a Word-style ribbon. You write in a page,
not in markup; Sentence keeps a compilable `.tex` in sync and can produce any
document LaTeX can — a two-column arXiv paper, a 300-page book with parts,
chapters, front matter and appendices, a one-page note, a letter.

Non-goals for now: `.docx` import/export, real-time collaboration, in-app git
replacement (git stays as it is).

## Document types (the core of "full-fledged")

`ProjectSettings.documentClass` selects the skeleton; the editor's structure
controls follow it:

| Class | Structure | Numbering |
|---|---|---|
| `article` | section → subsection → subsubsection | continuous |
| `report` | chapter → section → … | chapter-based, `\frontmatter`/`\mainmatter` |
| `book` | part → chapter → section → … | chapter-based, front/main/back matter |
| `letter` | no numbering, single `\begin{letter}` body | none |

Options that must reach the preamble and round-trip back into the settings:
`twocolumn`, paper size, geometry margins, base font size, `\linespread`,
paragraph indent vs parskip, `secnumdepth`, TOC depth, header/footer text,
line numbers, theorem numbering scope.

## Structure the visual model must hold

- headings: part, chapter, section, subsection, subsubsection, paragraph
  (level 0–5), each mapping to the class's actual command;
- front matter: title page, abstract, table of contents, list of figures,
  list of tables;
- back matter: appendix marker (lettered chapters), bibliography, index;
- environments: theorem / lemma / definition / proof / example (amsthm),
  code listing (lstlisting with caption + language), quote, verbatim;
- floats: figure and table with caption + label, plus `figure*`/`table*`
  (full width) when the document is two-column;
- cross-references and citations (already present) must resolve inside the
  new structure.

## Editor

- WYSIWYG math (MathLive `math-field`) for both inline and display equations,
  KaTeX rendering when not editing;
- symbol palette and LaTeX command autocomplete;
- source view with syntax highlighting, autocomplete and inline diagnostics
  taken from the compiler log (Tectonic messages mapped to lines);
- real pagination: page breaks drawn where the compiler would break, page
  count from real layout, not a word-count heuristic.

## UI

Keep the current tab set (File, Home, Insert, Layout, References, Review,
Paper, View, Git) and make it feel like Word 365:

- File = backstage panel (new, open, recent, save, export, print, info);
- ribbon groups with labelled buttons, collapsible (Ctrl+F1), quick-access bar;
- navigation pane with the heading tree, click to jump;
- status bar: page x of y, word count, language, view mode, zoom slider;
- light and dark themes built on shared tokens, focus mode, print preview.

## Quality bar

Every feature lands with unit tests for the LaTeX round trip
(`documentToLatex` ⇄ `latexToDocument`), and the Playwright gate in
`qa/smoke.mjs` must stay green. A feature that compiles a document the parser
cannot read back is not done.
