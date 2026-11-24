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

function createSizedEditor(rows: number, columns: number): Editor {
  const row = { type: "tableRow", content: Array.from({ length: columns }, () => cell(false)) };
  return new Editor({
    extensions: [StarterKit, TableKit.configure({ table: false }), CaptionTable],
    content: {
      type: "doc",
      content: [{ type: "table", content: Array.from({ length: rows }, () => row) }],
    },
  });
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
});
