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
  it("keeps the header in row 1 when a row is added above it", () => {
    const editor = createEditor(true);
    editor.commands.setTextSelection(cellPositions(editor)[0]);
    expect(editor.commands.addRowBefore()).toBe(true);
    expect(rowTypes(editor)).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    expect(editor.isActive("tableHeader")).toBe(true);
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

  it("walks the cells with Tab and releases the last one without adding a row", () => {
    const editor = createSizedEditor(2, 2);
    const positions = cellPositions(editor);
    editor.commands.setTextSelection(positions[0]);
    for (let index = 1; index < positions.length; index += 1) {
      expect(pressTab(editor)).toBe(true);
      expect(editor.state.selection.from).toBe(positions[index]);
    }
    expect(pressTab(editor)).toBe(false);
    expect(editor.state.selection.from).toBe(positions[positions.length - 1]);
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

  it("hands focus to the next control when Tab leaves the last cell", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createSizedEditor(2, 2, host);
    const button = document.createElement("button");
    button.getClientRects = () => ({ length: 1 }) as unknown as DOMRectList;
    document.body.appendChild(button);
    editor.commands.setTextSelection(cellPositions(editor)[3]);
    expect(pressTab(editor)).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(rowTypes(editor)).toHaveLength(2);
    editor.destroy();
    host.remove();
    button.remove();
  });
});
