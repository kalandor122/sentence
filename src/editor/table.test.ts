// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { documentToLatex, latexToDocument } from "../lib/latex";
import type { SentenceDocument } from "../lib/types";
import { CaptionTable } from "./table";

function cellType(header: boolean): "tableHeader" | "tableCell" {
  return header ? "tableHeader" : "tableCell";
}

function cell(header: boolean) {
  return { type: cellType(header), content: [{ type: "paragraph" }] };
}

function createEditor(withHeaderRow: boolean): Editor {
  const rows = (header: boolean) =>
    ({ type: "tableRow", content: [cell(header), cell(header)] });
  return new Editor({
    extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
    content: {
      type: "doc",
      content: [
        {
          type: "table",
          content: [rows(withHeaderRow), rows(false), rows(false)],
        },
      ],
    },
  });
}

function createSizedEditor(rows: number, columns: number, element?: HTMLElement): Editor {
  const row = { type: "tableRow", content: Array.from({ length: columns }, () => cell(false)) };
  const host = element ?? document.createElement("div");
  if (!element) document.body.appendChild(host);
  return new Editor({
    element: host,
    extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
    content: {
      type: "doc",
      content: [{ type: "table", content: Array.from({ length: rows }, () => row) }],
    },
  });
}

function pressTab(editor: Editor, back = false): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: back,
    bubbles: true,
    cancelable: true,
  });
  return editor.view.someProp("handleKeyDown", (handler) => handler(editor.view, event)) ?? false;
}

function tableRowTypes(document: SentenceDocument): string[][] {
  const table = document.content.find((node) => node.type === "table");
  return (table?.content ?? []).map((row) => (row.content ?? []).map((cell) => cell.type));
}

function rowTypes(editor: Editor): string[][] {
  return tableRowTypes(editor.getJSON() as SentenceDocument);
}

function cellPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "tableHeader" || node.type.name === "tableCell") {
      positions.push(pos + 2);
    }
  });
  return positions;
}

describe("CaptionTable", () => {
  it("reports adding a row above the header row as unavailable", () => {
    const editor = createEditor(true);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.can().addRowBefore()).toBe(false);
    expect(editor.commands.addRowBefore()).toBe(false);
    expect(rowTypes(editor)).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    expect(editor.isActive("tableHeader")).toBe(true);
    // The row below the header is the first body row, so that is the add
    // control the header row still offers.
    expect(editor.commands.addRowAfter()).toBe(true);
    expect(rowTypes(editor)).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    const restored = latexToDocument(latex, DEFAULT_SETTINGS).document;
    expect(tableRowTypes(restored)).toEqual(rowTypes(editor));
    editor.destroy();
  });

  it("adds a body row above a body row", () => {
    const editor = createEditor(true);
    editor.commands.setTextSelection(cellPositions(editor)[4]);
    expect(editor.commands.addRowBefore()).toBe(true);
    expect(rowTypes(editor)).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    editor.destroy();
  });

  it("adds a normal row above the first row of a headerless table", () => {
    const editor = createEditor(false);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.commands.addRowBefore()).toBe(true);
    expect(rowTypes(editor)).toEqual([
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    editor.destroy();
  });

  it("turns the header row off on a one-row table", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = new Editor({
      element: host,
      extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
      content: {
        type: "doc",
        content: [
          {
            type: "table",
            content: [{ type: "tableRow", content: [cell(true), cell(true), cell(true)] }],
          },
        ],
      },
    });
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.commands.toggleHeaderRow()).toBe(true);
    expect(rowTypes(editor)).toEqual([["tableCell", "tableCell", "tableCell"]]);
    expect(editor.isActive("tableHeader")).toBe(false);
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(latex).toContain("% Sentence table header: none");
    editor.destroy();
    host.remove();
  });

  it("reports deleting the last column as unavailable", () => {
    const editor = createSizedEditor(3, 2);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.can().deleteColumn()).toBe(true);
    expect(editor.commands.deleteColumn()).toBe(true);
    expect(tableRowTypes(editor.getJSON() as SentenceDocument)[0]).toHaveLength(1);
    expect(editor.can().deleteColumn()).toBe(false);
    expect(editor.commands.deleteColumn()).toBe(false);
    editor.destroy();
  });

  it("reports deleting the last row as unavailable", () => {
    const editor = createSizedEditor(2, 3);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.can().deleteRow()).toBe(true);
    expect(editor.commands.deleteRow()).toBe(true);
    expect(rowTypes(editor)).toHaveLength(1);
    expect(editor.can().deleteRow()).toBe(false);
    expect(editor.commands.deleteRow()).toBe(false);
    editor.destroy();
  });

  it("keeps the caret in the table when the last row is deleted", () => {
    const editor = createSizedEditor(3, 3);
    editor.commands.setTextSelection(cellPositions(editor)[7]);
    expect(editor.commands.deleteRow()).toBe(true);
    expect(rowTypes(editor)).toHaveLength(2);
    expect(editor.isActive("table")).toBe(true);
    editor.commands.insertContent("tail");
    expect(editor.isActive("table")).toBe(true);
    expect(editor.state.selection.$from.parent.textContent).toContain("tail");
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(latex).not.toMatch(/\\end\{table\}\s+tail/);
    editor.destroy();
  });

  it("keeps the caret in the table when the last column is deleted", () => {
    const editor = createSizedEditor(3, 3);
    editor.commands.setTextSelection(cellPositions(editor)[8]);
    expect(editor.commands.deleteColumn()).toBe(true);
    expect(rowTypes(editor)[0]).toHaveLength(2);
    expect(editor.isActive("table")).toBe(true);
    editor.commands.insertContent("aftercol");
    expect(editor.isActive("table")).toBe(true);
    expect(editor.state.selection.$from.parent.textContent).toContain("aftercol");
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(latex).not.toMatch(/\\end\{table\}\s+aftercol/);
    editor.destroy();
  });

  it("walks the cells with Tab and leaves the last one for the text after the table", () => {
    const editor = createSizedEditor(2, 2);
    const positions = cellPositions(editor);
    editor.commands.setTextSelection(positions[0]);
    for (let index = 1; index < positions.length; index += 1) {
      expect(pressTab(editor)).toBe(true);
      expect(editor.state.selection.from).toBe(positions[index]);
    }
    expect(pressTab(editor)).toBe(true);
    expect(editor.isActive("table")).toBe(false);
    expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
    expect(rowTypes(editor)).toHaveLength(2);
    editor.commands.insertContent("after");
    expect(editor.state.selection.$from.parent.textContent).toBe("after");
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(latex).toMatch(/\\end\{table\}\s+after/);
    editor.destroy();
  });

  it("uses the paragraph after the table instead of adding another", () => {
    const editor = createSizedEditor(2, 2);
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: "paragraph",
      content: [{ type: "text", text: "next" }],
    });
    editor.commands.setTextSelection(cellPositions(editor)[3]);
    expect(pressTab(editor)).toBe(true);
    expect(editor.isActive("table")).toBe(false);
    expect(editor.state.selection.$from.parent.textContent).toBe("next");
    expect(editor.state.doc.childCount).toBe(2);
    editor.destroy();
  });

  it("shows the caption above the table and clears it with the attribute", () => {
    const editor = createSizedEditor(2, 2);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.view.dom.querySelector("table > caption")).toBeNull();
    editor.commands.updateAttributes("table", { caption: "Data & results" });
    const caption = editor.view.dom.querySelector("table > caption");
    expect(caption?.textContent).toBe("Data & results");
    editor.commands.updateAttributes("table", { caption: "Second pass" });
    expect(editor.view.dom.querySelector("table > caption")?.textContent).toBe("Second pass");
    editor.commands.updateAttributes("table", { caption: "" });
    expect(editor.view.dom.querySelector("table > caption")).toBeNull();
    editor.destroy();
  });

  it("keeps the colgroup first so a caption cannot break column resizing", () => {
    const editor = createSizedEditor(2, 2);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    editor.commands.updateAttributes("table", { caption: "Captioned table" });
    const table = editor.view.dom.querySelector("table");
    // Dragging a column border passes table.firstChild to the resize helper as
    // the colgroup, so a caption placed ahead of it throws instead of resizing.
    expect(table?.firstChild?.nodeName).toBe("COLGROUP");
    expect(table?.querySelector(":scope > caption")?.textContent).toBe("Captioned table");
    editor.destroy();
  });

  it("keeps the caption in its HTML form", () => {
    const editor = createSizedEditor(2, 2);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    editor.commands.updateAttributes("table", { caption: "Data & results" });
    const html = editor.getHTML();
    expect(html).toContain("<caption>Data &amp; results</caption>");
    const reloaded = new Editor({
      extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
      content: html,
    });
    const table = (reloaded.getJSON() as SentenceDocument).content.find(
      (node) => node.type === "table",
    );
    expect(table?.attrs?.caption).toBe("Data & results");
    editor.destroy();
    reloaded.destroy();
  });

  it("keeps a table label on the node through a visual edit", () => {
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
      "\\end{document}",
    ].join("\n");
    const parsed = latexToDocument(source, DEFAULT_SETTINGS).document;
    const editor = new Editor({
      extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
      content: parsed,
    });
    editor.commands.setTextSelection(cellPositions(editor)[2]);
    editor.commands.insertContent("edited");
    const document = editor.getJSON() as SentenceDocument;
    const table = document.content.find((node) => node.type === "table");
    expect(table?.attrs?.label).toBe("tab:zxtable");
    const exported = documentToLatex(document, DEFAULT_SETTINGS);
    expect(exported).toContain("\\label{tab:zxtable}");
    editor.destroy();
  });

  it("keeps a spanning \\multicolumn header through a visual edit", () => {
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
    const editor = new Editor({
      extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
      content: parsed,
    });
    const table = (editor.getJSON() as SentenceDocument).content.find(
      (node) => node.type === "table",
    );
    expect(table?.content?.[0]?.content).toHaveLength(1);
    expect(table?.content?.[0]?.content?.[0]?.attrs?.colspan).toBe(2);
    expect(editor.view.dom.querySelector("th")?.getAttribute("colspan")).toBe("2");
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    editor.commands.insertContent("edited ");
    const exported = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(exported).toContain("\\multicolumn{2}{c}{edited ZXMULTI HEADER} \\\\");
    expect(exported).not.toContain("textbackslash");
    editor.destroy();
  });

  it("keeps a Shift+Enter line break inside the cell it was typed in", () => {
    const editor = createSizedEditor(2, 2);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    editor.commands.insertContent("one");
    editor.commands.setHardBreak();
    editor.commands.insertContent("two");
    const latex = documentToLatex(editor.getJSON() as SentenceDocument, DEFAULT_SETTINGS);
    expect(latex).toContain("\\shortstack[l]{one\\\\two} &  \\\\");
    expect(rowTypes(editor)).toHaveLength(2);
    editor.destroy();
  });

  it("moves the caret back with Shift-Tab", () => {
    const editor = createSizedEditor(2, 2);
    const positions = cellPositions(editor);
    editor.commands.setTextSelection(positions[3]);
    expect(pressTab(editor, true)).toBe(true);
    expect(editor.state.selection.from).toBe(positions[2]);
    editor.destroy();
  });

  it("keeps typing in the document when Tab leaves the last cell", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createSizedEditor(2, 2, host);
    const button = document.createElement("button");
    button.getClientRects = () => ({ length: 1 }) as unknown as DOMRectList;
    document.body.appendChild(button);
    editor.commands.setTextSelection(cellPositions(editor)[3]);
    expect(pressTab(editor)).toBe(true);
    expect(document.activeElement).not.toBe(button);
    editor.commands.insertContent("AFTER");
    expect(editor.state.selection.$from.parent.textContent).toBe("AFTER");
    expect(editor.isActive("table")).toBe(false);
    expect(rowTypes(editor)).toHaveLength(2);
    editor.destroy();
    host.remove();
    button.remove();
  });
});
