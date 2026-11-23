import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  documentToHtml,
  documentToMarkdown,
  htmlToDocument,
  markdownToDocument,
} from "./exporters";
import type { ProjectSettings, SentenceDocument } from "./types";

const settings: ProjectSettings = {
  ...DEFAULT_SETTINGS,
  title: "Export test",
  author: "Ada Lovelace",
  subtitle: "A quiet subtitle",
  date: "2026-11-23",
  abstract: "A short abstract.\n\nWith a second paragraph.",
  keywords: "html, markdown",
};

const document: SentenceDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Export test" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Some " },
        { type: "text", text: "important", marks: [{ type: "bold" }] },
        { type: "text", text: " and " },
        { type: "text", text: "linked", marks: [{ type: "link", attrs: { href: "https://example.org/a_b" } }] },
        { type: "text", text: " words with " },
        { type: "text", text: "code", marks: [{ type: "code" }] },
        { type: "text", text: "." },
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
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Nested" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Third" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A quotation." }] },
      ],
    },
    { type: "codeBlock", content: [{ type: "text", text: "let x = 1 < 2;" }] },
    { type: "horizontalRule" },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Energy " },
        { type: "mathInline", attrs: { latex: "E=mc^2" } },
        { type: "text", text: " and " },
        { type: "citation", attrs: { key: "einstein1905" } },
        { type: "text", text: " plus " },
        { type: "footnote", attrs: { text: "A note" } },
        { type: "text", text: " and " },
        { type: "crossReference", attrs: { label: "sec:one" } },
        { type: "text", text: "." },
      ],
    },
    {
      type: "image",
      attrs: {
        src: "data:image/png;base64,iVBORw0KGgo==",
        alt: "diagram.png",
      },
    },
    {
      type: "table",
      attrs: { caption: "Results" },
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: { align: "center" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Name" }] }],
            },
            {
              type: "tableHeader",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Value" }] }],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "R&D" }] }],
            },
            {
              type: "tableCell",
              attrs: { align: "right" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "42" }] }],
            },
          ],
        },
      ],
    },
  ],
};

describe("HTML export", () => {
  it("serializes the supported subset to semantic markup", () => {
    const html = documentToHtml(document, settings);
    expect(html).toContain("<title>Export test</title>");
    expect(html).toContain("<strong>important</strong>");
    expect(html).toContain('<a href="https://example.org/a_b">linked</a>');
    expect(html).toContain("<ul><li><p>One</p><ul>");
    expect(html).toContain('<ol start="3">');
    expect(html).toContain("<blockquote><p>A quotation.</p></blockquote>");
    expect(html).toContain("<pre><code>let x = 1 &lt; 2;</code></pre>");
    expect(html).toContain('<img src="assets/images/diagram.png"');
    expect(html).toContain("<caption>Results</caption>");
    expect(html).not.toContain("data:image");
    expect(html).not.toContain("<h1>Export test</h1>\n<h1>Export test</h1>");
  });

  it("round-trips the supported subset through HTML", () => {
    const html = documentToHtml(document, settings);
    const parsed = htmlToDocument(html, DEFAULT_SETTINGS);
    expect(parsed.settings.title).toBe("Export test");
    expect(parsed.settings.author).toBe("Ada Lovelace");
    expect(parsed.document.content.map((node) => node.type)).toEqual(
      document.content.slice(1).map((node) => node.type),
    );
    expect(documentToHtml(parsed.document, parsed.settings)).toBe(html);
  });
});

describe("Markdown export", () => {
  it("serializes the supported subset to portable Markdown", () => {
    const markdown = documentToMarkdown(document, settings);
    expect(markdown).toContain('title: "Export test"');
    expect(markdown).toContain("# Export test");
    expect(markdown).toContain("**important**");
    expect(markdown).toContain("[linked](https://example.org/a_b)");
    expect(markdown).toContain("- One");
    expect(markdown).toContain("3. Third");
    expect(markdown).toContain("> A quotation.");
    expect(markdown).toContain("```\nlet x = 1 < 2;\n```");
    expect(markdown).toContain("![diagram.png](assets/images/diagram.png)");
    expect(markdown).toContain("| Name | Value |");
    expect(markdown).not.toContain("data:image");
  });

  it("round-trips the supported subset through Markdown", () => {
    const markdown = documentToMarkdown(document, settings);
    const parsed = markdownToDocument(markdown, DEFAULT_SETTINGS);
    expect(parsed.settings.title).toBe("Export test");
    expect(parsed.settings.author).toBe("Ada Lovelace");
    expect(parsed.document.content.map((node) => node.type)).toEqual(
      document.content.slice(1).map((node) => node.type),
    );
    expect(documentToMarkdown(parsed.document, parsed.settings)).toBe(markdown);
  });
});
