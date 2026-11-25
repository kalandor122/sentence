import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Citation,
  CommentMark,
  CrossReference,
  Footnote,
  HeadingLabel,
  InlineProjectImage,
  MathBlock,
  MathInline,
  PageBreak,
  ProjectImage,
  TableOfContents,
  ViewModeShortcuts,
} from "./extensions";
import { FindHighlight } from "./find";
import { focusAfterEditor } from "./focus";
import { changeIndent, nestListItem } from "./indent";
import { liftEmptyNestedItem, splitListItemKeepingSublist, splitOrderedListOnEmptyItem, toggleList } from "./listToggle";
import { LINE_HEIGHTS, LineSpacing, setLineSpacing } from "./lineSpacing";
import { PageGaps, setPageGaps } from "./pageGaps";
import {
  pageBreakFill,
  pageCountFromBottom,
  pageGeometry,
  pageLineGaps,
} from "./pagination";
import { RevisionMarks, setRevisionMarks } from "./revisions";
import {
  ColorMark,
  FontFamilyMark,
  FontSizeMark,
  HighlightMark,
} from "./textStyleMarks";
import { CaptionTable } from "./table";
import { setGeneratedToc, setTocTitle } from "./TocBlock";
import { commentAnchors } from "../lib/comments";
import type {
  CommentThread,
  ProjectSettings,
  Revision,
  SentenceDocument,
} from "../lib/types";

// Inline atoms that have no in-place text: clicking one selects the whole node,
// so typing must land beside it instead of replacing it.
const PRESERVED_ON_TYPING = new Set(["footnote", "citation", "crossReference"]);

interface EditorSurfaceProps {
  document: SentenceDocument;
  settings: ProjectSettings;
  comments: CommentThread[];
  revisions: Revision[];
  editable?: boolean;
  // undoneComments carries the comment marks an undo removed from the
  // document, so their threads can go with the highlight.
  onUpdate: (document: SentenceDocument, undoneComments?: string[]) => void;
  onReady: (editor: Editor | null) => void;
  onStateChange: () => void;
  onCommentSelected: (markId: string) => void;
  onEditMath: (latex: string, display: boolean, environment: string) => void;
  onEditFootnote: (text: string, position: number) => void;
  onPageCountChange: (pages: number) => void;
}

const FONT_STACKS: Record<ProjectSettings["fontFamily"], string> = {
  default: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  times: '"Times New Roman", Times, Georgia, serif',
  palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
};

// Tab is focus navigation, so outside lists it leaves the page instead of
// editing the manuscript. Lists still nest, tables keep their own cell walk and
// Escape leaves from either, so the page never traps the keyboard. Paragraph
// indentation has its own shortcuts because Tab must not modify text.
const TabIndent = Extension.create({
  name: "sentenceTabIndent",
  priority: 200,
  addKeyboardShortcuts() {
    return {
      Tab: () => nestListItem(this.editor, false),
      "Shift-Tab": () => nestListItem(this.editor, true),
      "Mod-]": () => changeIndent(this.editor, false),
      "Mod-[": () => changeIndent(this.editor, true),
      Escape: () => focusAfterEditor(this.editor),
    };
  },
});

// Tiptap's own list shortcuts call toggleBulletList/toggleOrderedList, which
// append an empty item instead of unwrapping when the whole document is
// selected. Route them through the shared toggle for the same behaviour as the
// ribbon buttons.
const ListShortcuts = Extension.create({
  name: "sentenceListShortcuts",
  priority: 200,
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-7": () => toggleList(this.editor, "orderedList"),
      "Mod-Shift-8": () => toggleList(this.editor, "bulletList"),
    };
  },
});

// Ctrl+End/Ctrl+Home jump to the document end/start. The WebView's own jump can
// leave the caret below the scrolled page, and when the caret is already at the
// boundary the selection does not change, so nothing scrolls at all. Dispatching
// the selection with scrollIntoView makes the view follow the caret every time.
const DocumentJumps = Extension.create({
  name: "sentenceDocumentJumps",
  priority: 200,
  addKeyboardShortcuts() {
    const jump = (toEnd: boolean) => () => {
      const { state } = this.editor;
      const selection = toEnd ? Selection.atEnd(state.doc) : Selection.atStart(state.doc);
      this.editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
      return true;
    };
    return {
      "Mod-End": jump(true),
      "Mod-Home": jump(false),
    };
  },
});

// Enter at the end of a list item with a nested sublist keeps that sublist
// under the item it belongs to; the default split would give it to the new
// sibling. Enter on an empty nested item outdents it, since there is nothing to
// split.
const ListEnter = Extension.create({
  name: "sentenceListEnter",
  priority: 200,
  addKeyboardShortcuts() {
    return {
      Enter: () =>
        splitListItemKeepingSublist(this.editor) ||
        liftEmptyNestedItem(this.editor) ||
        splitOrderedListOnEmptyItem(this.editor),
    };
  },
});

// The WebView's native spellchecker uses lang to pick a dictionary; keeping
// these in one place avoids drift between editor creation and later toggles.
function editorAttributes(spellcheck: boolean) {
  return {
    class: "sentence-editor",
    spellcheck: spellcheck ? "true" : "false",
    lang: "en",
    autocorrect: "on",
    "aria-label": "Document editor",
    "aria-multiline": "true",
  };
}

function commentMarkIds(document: SentenceDocument): Set<string> {
  return new Set(commentAnchors(document).map((anchor) => anchor.markId));
}

function removedCommentIds(before: SentenceDocument, after: SentenceDocument): string[] {
  const remaining = commentMarkIds(after);
  return [...commentMarkIds(before)].filter((markId) => !remaining.has(markId));
}

function offsetWithin(element: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

interface TextLine {
  top: number;
  bottom: number;
  left: number;
  viewportTop: number;
  viewportHeight: number;
  node: Text;
  fragment: DOMRect;
}

// Text line boxes inside a block, relative to its border box in unscaled layout
// pixels. Each line remembers the text node and DOM rect it starts with, so the
// start can be mapped back to a document position even when it is scrolled out
// of the viewport.
function textLines(block: HTMLElement, zoom: number): TextLine[] {
  const blockRect = block.getBoundingClientRect();
  const fragments: Array<{ rect: DOMRect; node: Text }> = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue;
      fragments.push({ rect, node });
    }
  }
  fragments.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  const lines: TextLine[] = [];
  for (const { rect, node } of fragments) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(rect.top - line.viewportTop) < Math.max(2, line.viewportHeight / 2)) {
      line.bottom = (Math.max(rect.bottom, line.viewportTop + line.viewportHeight) - blockRect.top) / zoom;
      line.viewportHeight = Math.max(rect.bottom - line.viewportTop, line.viewportHeight);
      if (rect.left < line.left) {
        line.left = rect.left;
        line.node = node;
        line.fragment = rect;
      }
      continue;
    }
    lines.push({
      top: (rect.top - blockRect.top) / zoom,
      bottom: (rect.bottom - blockRect.top) / zoom,
      left: rect.left,
      viewportTop: rect.top,
      viewportHeight: rect.height,
      node,
      fragment: rect,
    });
  }
  return lines;
}

// The document position at the start of a line, used to put a page gap before
// the first character that belongs on the next page.
function lineStartPosition(view: Editor["view"], line: TextLine): number | null {
  const node = line.node;
  let low = 0;
  let high = node.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const range = document.createRange();
    range.setStart(node, middle);
    range.setEnd(node, middle + 1);
    const rect = range.getBoundingClientRect();
    if (rect.top < line.fragment.top - 1) low = middle + 1;
    else high = middle;
  }
  try {
    return view.posAtDOM(node, low);
  } catch {
    return null;
  }
}

export default function EditorSurface({
  document,
  settings,
  comments,
  revisions,
  editable = true,
  onUpdate,
  onReady,
  onStateChange,
  onCommentSelected,
  onEditMath,
  onEditFootnote,
  onPageCountChange,
}: EditorSurfaceProps) {
  const editFootnoteRef = useRef(onEditFootnote);
  useEffect(() => {
    editFootnoteRef.current = onEditFootnote;
  }, [onEditFootnote]);
  const firstNode = document.content[0];
  const repeatsTitle =
    firstNode?.type === "heading" &&
    Number(firstNode.attrs?.level ?? 1) === 1 &&
    (firstNode.content ?? []).map((node) => node.text ?? "").join("").trim().toLocaleLowerCase() ===
      settings.title.trim().toLocaleLowerCase();
  const showFrontMatter = Boolean(settings.title.trim() && !repeatsTitle);
  const authors = settings.author
    .split(/\r?\n|;/)
    .map((name) => name.trim())
    .filter(Boolean);
  const lastEmitted = useRef("");
  const [pageCount, setPageCount] = useState(1);
  const geometry = pageGeometry(settings);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      ProjectImage.configure({
        allowBase64: true,
        inline: false,
      }),
      InlineProjectImage.configure({ allowBase64: true }),
      Placeholder.configure({
        placeholder: "Begin with a sentence...",
        showOnlyWhenEditable: true,
      }),
      Subscript,
      Superscript,
      TableKit.configure({ table: false }),
      CaptionTable.configure({ resizable: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      FontFamilyMark,
      FontSizeMark,
      ColorMark,
      HighlightMark,
      MathInline,
      MathBlock,
      Citation,
      Footnote,
      CrossReference,
      HeadingLabel,
      PageBreak,
      PageGaps,
      TableOfContents,
      CommentMark,
      FindHighlight,
      RevisionMarks,
      LineSpacing,
      TabIndent,
      ListShortcuts,
      ListEnter,
      DocumentJumps,
      ViewModeShortcuts,
    ],
    content: document,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: editorAttributes(settings.spellcheck),
      handleClick(_view, _position, event) {
        const target = event.target as HTMLElement;
        const math = target.closest<HTMLElement>("[data-math-inline],[data-math-block]");
        if (math) {
          const display = Boolean(math.dataset.mathBlock !== undefined);
          onEditMath(math.dataset.latex ?? "", display, math.dataset.mathEnvironment ?? "");
          return false;
        }
        const mark = target.closest<HTMLElement>("[data-comment-id]");
        if (mark?.dataset.commentId) {
          onCommentSelected(mark.dataset.commentId);
        }
        return false;
      },
      // Editing a note mirrors math: the atom itself is not editable in place,
      // so double-clicking its marker opens the note for correction. Typing
      // while the atom is selected would otherwise replace the note with text.
      handleDoubleClick(view, _position, event) {
        const target = event.target as HTMLElement;
        const marker = target.closest<HTMLElement>("[data-footnote]");
        if (!marker) return false;
        const position = view.posAtDOM(marker, 0);
        const node = view.state.doc.nodeAt(position);
        if (node?.type.name !== "footnote") return false;
        editFootnoteRef.current(typeof node.attrs.text === "string" ? node.attrs.text : "", position);
        return true;
      },
      // A citation, cross-reference or footnote marker is an atom, so clicking
      // it selects the whole node and the next keystroke would replace it with
      // body text. Typing while the atom is selected lands beside it instead;
      // removing the reference stays an explicit Backspace/Delete.
      handleTextInput(view, _from, _to, text) {
        const { selection } = view.state;
        if (!(selection instanceof NodeSelection) || !PRESERVED_ON_TYPING.has(selection.node.type.name)) return false;
        const position = selection.to;
        const transaction = view.state.tr.insertText(text, position).scrollIntoView();
        transaction.setSelection(TextSelection.create(transaction.doc, position + text.length));
        view.dispatch(transaction);
        return true;
      },
      // Keyboard access to the same editors: select the atom with the arrow
      // keys and press Enter.
      handleKeyDown(view, event) {
        if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        const { selection } = view.state;
        if (!(selection instanceof NodeSelection)) return false;
        const { attrs } = selection.node;
        const name = selection.node.type.name;
        if (name === "mathInline" || name === "mathBlock") {
          event.preventDefault();
          const latex = attrs.latex;
          const environment = attrs.environment;
          onEditMath(
            typeof latex === "string" ? latex : "",
            name === "mathBlock",
            typeof environment === "string" ? environment : "",
          );
          return true;
        }
        if (name !== "footnote") return false;
        event.preventDefault();
        const text = selection.node.attrs.text;
        editFootnoteRef.current(typeof text === "string" ? text : "", selection.from);
        return true;
      },
    },
    onUpdate: ({ editor: current, transaction, appendedTransactions }) => {
      const json = current.getJSON() as SentenceDocument;
      // Editor setup (including React StrictMode's discarded instance) emits a
      // transaction with no edit steps but with Tiptap's default attrs filled
      // in. Treating that as an edit dirtied a restored document and made an
      // idle autosave rewrite its stored model. Focus is unreliable here:
      // Tiptap defers focus from toolbar commands, so a Delete table click emits
      // a real one-step edit while the editor is still unfocused.
      if (![transaction, ...appendedTransactions].some((tr) => tr.steps.length > 0)) return;
      // A comment whose mark an undo removed no longer has a highlight, so its
      // thread must be dropped too instead of looking like deleted text.
      // prosemirror-history keys its meta "history$" and records whether the
      // transaction is an undo (redo: false) or a redo.
      const history = transaction.getMeta("history$");
      const undone = history?.redo === false;
      lastEmitted.current = JSON.stringify(json);
      onUpdate(
        json,
        undone
          ? removedCommentIds(transaction.before.toJSON() as SentenceDocument, json)
          : undefined,
      );
    },
    onTransaction: () => {
      onStateChange();
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(document);
    if (incoming === JSON.stringify(editor.getJSON()) || incoming === lastEmitted.current) {
      return;
    }
    lastEmitted.current = incoming;
    editor.commands.setContent(document, { emitUpdate: false });
  }, [document, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    editor?.commands.setMeta("comments", comments);
  }, [comments, editor]);

  useEffect(() => {
    if (!editor) return;
    setRevisionMarks(editor, revisions);
  }, [editor, revisions]);

  useEffect(() => {
    if (!editor) return;
    setLineSpacing(editor, settings.lineSpacing);
  }, [editor, settings.lineSpacing]);

  useEffect(() => {
    if (!editor) return;
    setTocTitle(editor, settings.title);
  }, [editor, settings.title]);

  useEffect(() => {
    if (!editor) return;
    setGeneratedToc(editor, settings.includeToc);
  }, [editor, settings.includeToc]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: editorAttributes(settings.spellcheck),
      },
    });
  }, [editor, settings.spellcheck]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const sheet = dom.closest<HTMLElement>(".paper-sheet");
    if (!sheet) {
      setPageCount(1);
      onPageCountChange(1);
      return;
    }
    let frame = 0;
    let gapsApplied = false;
    // Page snapping and line gaps move the text after ProseMirror has already
    // scrolled to the caret, so a paste lands below the visible area. Follow the
    // caret once the page layout has settled after an edit.
    let followCaret = false;
    // Blocks nudged down when they do not fit inside a page's text area, so no
    // line or heading is left in the top or bottom margin. The rules live in a
    // style element because ProseMirror re-renders text nodes and would drop
    // inline padding, and padding is used because sibling margins collapse.
    const snapStyle = window.document.createElement("style");
    window.document.head.appendChild(snapStyle);
    const snapScope = `data-page-snap-${Math.random().toString(36).slice(2)}`;
    dom.setAttribute(snapScope, "");
    const snapSelector = `.sentence-editor[${snapScope}]`;
    const basePadding = new Map<number, number>();
    const snapShifts = new Map<number, number>();
    const applySnap = () => {
      snapStyle.textContent = Array.from(snapShifts)
        .map(
          ([index, shift]) =>
            `${snapSelector} > :nth-child(${index + 1}) { padding-top: ${(basePadding.get(index) ?? 0) + shift}px; }`,
        )
        .join("\n");
    };
    const resetSnap = () => {
      basePadding.clear();
      snapShifts.clear();
      snapStyle.textContent = "";
    };
    const snapBlock = (block: HTMLElement, index: number, shift: number) => {
      if (!basePadding.has(index)) {
        basePadding.set(index, parseFloat(getComputedStyle(block).paddingTop) || 0);
      }
      snapShifts.set(index, (snapShifts.get(index) ?? 0) + shift);
      applySnap();
    };
    const snapToPages = () => {
      resetSnap();
      // Keep the child index so the generated :nth-child rules keep pointing at
      // the same block when page-break wrappers sit among them.
      const blocks = Array.from(dom.children) as HTMLElement[];
      // A nudge is padding, so it moves the content but not the border box.
      // Measure the content box: otherwise a shifted block still reports its
      // old position and collects another shift on every pass.
      const contentBox = (block: HTMLElement) => {
        const padding = parseFloat(getComputedStyle(block).paddingTop) || 0;
        return {
          top: offsetWithin(block, sheet) + padding,
          height: block.offsetHeight - padding,
        };
      };
      // Bottom of the page's text area, i.e. where the bottom margin starts.
      const contentBottomLimit = (top: number) =>
        (Math.floor(Math.max(0, top) / geometry.height) + 1) * geometry.height - geometry.margin;
      // Top of the text area on the page after the one that holds `top`.
      const nextPageTopMargin = (top: number) =>
        (Math.floor(Math.max(0, top) / geometry.height) + 1) * geometry.height + geometry.margin;
      // A block taller than one page is split at the page edges. Inserting a
      // gap between two lines keeps the model as one paragraph while moving the
      // rest of the text to the next page's top margin.
      const planGaps = () => {
        const sheetRect = sheet.getBoundingClientRect();
        const zoom = sheet.offsetHeight ? sheetRect.height / sheet.offsetHeight : 1;
        const gaps: Array<{ pos: number; height: number }> = [];
        let gapShift = 0;
        for (const block of blocks) {
          if (!(block instanceof HTMLElement) || block.hasAttribute("data-page-break")) continue;
          // Lists and blockquotes hold their text in child blocks, but a long
          // one still has to be split at the page edges like a paragraph.
          if (!/^(P|H[1-3]|UL|OL|BLOCKQUOTE)$/.test(block.tagName)) continue;
          if (block.offsetHeight <= geometry.contentHeight) continue;
          const lines = textLines(block, zoom);
          const top = offsetWithin(block, sheet);
          const planned = pageLineGaps(
            lines.map((line) => ({
              top: line.top + top + gapShift,
              bottom: line.bottom + top + gapShift,
            })),
            top + gapShift,
            top + block.offsetHeight + gapShift,
            geometry,
          );
          for (const gap of planned) {
            const pos = lineStartPosition(editor.view, lines[gap.line]);
            if (pos === null) continue;
            gaps.push({ pos, height: gap.height });
          }
          gapShift += planned.reduce((total, gap) => total + gap.height, 0);
        }
        return gaps;
      };
      for (let pass = 0; pass <= blocks.length * 2 + 8; pass += 1) {
        // Plan from the unsplit layout, then apply the gaps before checking the
        // blocks that still move as a whole.
        if (gapsApplied) {
          setPageGaps(editor.view, []);
          gapsApplied = false;
        }
        const gaps = planGaps();
        if (gaps.length > 0) {
          setPageGaps(editor.view, gaps);
          gapsApplied = true;
        }
        let moved = false;
        for (let index = 0; index < blocks.length; index += 1) {
          const block = blocks[index];
          if (!(block instanceof HTMLElement) || block.hasAttribute("data-page-break")) continue;
          const box = contentBox(block);
          // Tall blocks are handled by their line gaps, not by moving them.
          if (box.height > geometry.contentHeight) continue;
          // Blocks move whole: a block either fits inside the current page's
          // text area or starts at the top margin of the next page, so no line
          // is ever cut at a page edge or left sitting in a margin.
          let overflow = box.top + box.height > contentBottomLimit(box.top);
          if (!overflow && /^H[1-3]$/.test(block.tagName)) {
            // Keep a heading on the same page as the body it introduces. An
            // explicit page break right after the heading is left alone.
            const next = block.nextElementSibling as HTMLElement | null;
            const nextBox =
              next && !next.hasAttribute("data-page-break") ? contentBox(next) : null;
            if (nextBox && nextBox.height <= geometry.contentHeight) {
              const pageTop = Math.floor(Math.max(0, box.top) / geometry.height) * geometry.height;
              const nextPageTop =
                Math.floor(Math.max(0, nextBox.top) / geometry.height) * geometry.height;
              overflow =
                nextPageTop !== pageTop ||
                nextBox.top + nextBox.height > contentBottomLimit(nextBox.top);
            }
          }
          if (!overflow) continue;
          snapBlock(block, index, nextPageTopMargin(box.top) - box.top);
          moved = true;
          break;
        }
        if (!moved) break;
      }
    };

    const paginate = () => {
      frame = 0;
      const wrappers = Array.from(dom.querySelectorAll<HTMLElement>("[data-page-break]"));
      for (const wrapper of wrappers) wrapper.style.paddingTop = "0px";
      // Measure every break before changing any padding: one break's fill moves
      // all the breaks that follow it.
      const tops = wrappers.map((wrapper) => offsetWithin(wrapper, sheet));
      let shift = 0;
      wrappers.forEach((wrapper, index) => {
        const fill = pageBreakFill(tops[index] + shift, wrapper.offsetHeight, geometry);
        wrapper.style.paddingTop = `${fill}px`;
        shift += fill;
      });
      snapToPages();
      // The sheet's min-height is derived from the count, so measure the last
      // block rather than the editor box. Explicit breaks always claim a page.
      const lastBlock = dom.lastElementChild as HTMLElement | null;
      const contentBottom = lastBlock
        ? offsetWithin(lastBlock, sheet) + lastBlock.offsetHeight
        : offsetWithin(dom, sheet);
      const pages = Math.max(
        pageCountFromBottom(contentBottom, geometry),
        wrappers.length + 1,
      );
      setPageCount(pages);
      onPageCountChange(pages);
      if (followCaret) {
        followCaret = false;
        // Only dispatch when the caret actually ended up outside the visible
        // page: an empty transaction per keystroke would re-render the chrome.
        const scroller = dom.closest<HTMLElement>(".visual-editor-scroll");
        if (scroller) {
          const bounds = scroller.getBoundingClientRect();
          const caret = editor.view.coordsAtPos(editor.state.selection.head);
          if (caret.top < bounds.top || caret.bottom > bounds.bottom) {
            // The empty transaction only asks ProseMirror to reveal the
            // selection: its position is now measured after pagination.
            editor.view.dispatch(editor.view.state.tr.scrollIntoView());
          }
        }
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paginate);
    };
    const scheduleFollow = () => {
      followCaret = true;
      schedule();
    };

    schedule();
    editor.on("update", scheduleFollow);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(dom);
    // Front matter lives outside the editor but still consumes the first page.
    observer.observe(sheet);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      editor.off("update", scheduleFollow);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      resetSnap();
      snapStyle.remove();
      dom.removeAttribute(snapScope);
      for (const wrapper of dom.querySelectorAll<HTMLElement>("[data-page-break]")) {
        wrapper.style.paddingTop = "";
      }
    };
  }, [editor, geometry.height, geometry.margin, comments, onPageCountChange]);

  const paperStyle = {
    "--paper-font": FONT_STACKS[settings.fontFamily],
    "--paper-line-height": LINE_HEIGHTS[settings.lineSpacing],
    "--paper-width": `${geometry.width}px`,
    "--paper-height": `${geometry.height}px`,
    "--paper-content-height": `${geometry.contentHeight}px`,
    "--paper-margin": `${geometry.margin}px`,
    "--paper-font-size": `${geometry.fontSize}px`,
    "--sentence-page-count": pageCount,
    "--para-before": `${settings.paragraphSpaceBefore ?? 0}pt`,
    "--para-after": `${settings.paragraphSpaceAfter ?? 10}pt`,
  } as CSSProperties;

  return (
    <div className="visual-editor-scroll" style={paperStyle}>
      <div className="paper-stack" aria-hidden="true" />
      <article
        className="paper-sheet"
        style={paperStyle}
      >
        {showFrontMatter ? (
          <header className="paper-frontmatter">
            <h1>{settings.title}</h1>
            {settings.subtitle.trim() ? <p className="paper-subtitle">{settings.subtitle}</p> : null}
            {authors.length > 0 ? <p className="paper-authors">{authors.join("  ·  ")}</p> : null}
            {settings.affiliation.trim() || settings.email.trim() ? (
              <p className="paper-affiliation">
                {settings.affiliation.trim()}
                {settings.affiliation.trim() && settings.email.trim() ? "  ·  " : ""}
                {settings.email.trim()}
              </p>
            ) : null}
            {settings.abstract.trim() ? (
              <section className="paper-abstract">
                <strong>Abstract</strong>
                <p>{settings.abstract}</p>
              </section>
            ) : null}
          </header>
        ) : null}
        <EditorContent editor={editor} className="paper-editor-content" />
      </article>
    </div>
  );
}
