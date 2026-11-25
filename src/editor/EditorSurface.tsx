import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { NodeSelection } from "@tiptap/pm/state";
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
} from "./extensions";
import { FindHighlight } from "./find";
import { focusAfterEditor } from "./focus";
import { changeIndent, nestListItem } from "./indent";
import { toggleList } from "./listToggle";
import { LINE_HEIGHTS, LineSpacing, setLineSpacing } from "./lineSpacing";
import {
  pageBoundaryWithin,
  pageBreakFill,
  pageCountFromBottom,
  pageGeometry,
} from "./pagination";
import { RevisionMarks, setRevisionMarks } from "./revisions";
import {
  ColorMark,
  FontFamilyMark,
  FontSizeMark,
  HighlightMark,
} from "./textStyleMarks";
import { CaptionTable } from "./table";
import type {
  CommentThread,
  ProjectSettings,
  Revision,
  SentenceDocument,
} from "../lib/types";

interface EditorSurfaceProps {
  document: SentenceDocument;
  settings: ProjectSettings;
  comments: CommentThread[];
  revisions: Revision[];
  editable?: boolean;
  onUpdate: (document: SentenceDocument) => void;
  onReady: (editor: Editor | null) => void;
  onStateChange: () => void;
  onCommentSelected: (markId: string) => void;
  onEditMath: (latex: string, display: boolean) => void;
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

// The WebView's native spellchecker uses lang to pick a dictionary; keeping
// these in one place avoids drift between editor creation and later toggles.
function editorAttributes(spellcheck: boolean) {
  return {
    class: "sentence-editor",
    spellcheck: spellcheck ? "true" : "false",
    lang: "en",
    autocorrect: "on",
    "aria-label": "Document editor",
  };
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

// Text line boxes inside a block, relative to its border box in unscaled layout
// pixels. The sheet and its contents are CSS-scaled by the editor zoom.
function lineBoxes(block: HTMLElement, zoom: number): Array<{ top: number; bottom: number }> {
  const blockTop = block.getBoundingClientRect().top;
  const boxes: Array<{ top: number; bottom: number }> = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width < 1 || rect.height < 1) continue;
      boxes.push({
        top: (rect.top - blockTop) / zoom,
        bottom: (rect.bottom - blockTop) / zoom,
      });
    }
  }
  return boxes.sort((a, b) => a.top - b.top);
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
      TableOfContents,
      CommentMark,
      FindHighlight,
      RevisionMarks,
      LineSpacing,
      TabIndent,
      ListShortcuts,
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
          onEditMath(math.dataset.latex ?? "", display);
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
      // Keyboard access to the same editor: select the marker with the arrow
      // keys and press Enter.
      handleKeyDown(view, event) {
        if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        const { selection } = view.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== "footnote") return false;
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
      lastEmitted.current = JSON.stringify(json);
      onUpdate(json);
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
    // Blocks nudged away from a rule so the divider falls between two lines
    // instead of across one. Body text shifts by less than a line; a heading or
    // a first line starts on the next page. The rules live in a style element
    // because ProseMirror re-renders text nodes and would drop inline padding,
    // and padding is used because sibling margins collapse.
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
      const sheetRect = sheet.getBoundingClientRect();
      const zoom = sheet.offsetHeight ? sheetRect.height / sheet.offsetHeight : 1;
      for (let pass = 0; pass <= blocks.length * 2 + 8; pass += 1) {
        let moved = false;
        for (let index = 0; index < blocks.length; index += 1) {
          const block = blocks[index];
          if (!(block instanceof HTMLElement) || block.hasAttribute("data-page-break")) continue;
          const top = offsetWithin(block, sheet);
          // A nudge is padding, so it moves the content but not the border box.
          // Measure the content box: otherwise a shifted block still straddles
          // the same rule and collects another shift on every pass.
          const padding = parseFloat(getComputedStyle(block).paddingTop) || 0;
          const contentTop = top + padding;
          const contentHeight = block.offsetHeight - padding;
          const boundary = pageBoundaryWithin(
            contentTop,
            contentTop + contentHeight,
            geometry,
          );
          if (boundary === null || contentHeight > geometry.contentHeight) continue;
          let shift: number;
          if (/^H[1-3]$/.test(block.tagName)) {
            // A heading on a rule reads as a strikethrough; start it on the next page.
            shift = boundary + geometry.margin - contentTop;
          } else {
            const boxes = lineBoxes(block, zoom);
            const line = boxes.findIndex(
              (box) => top + box.top < boundary && top + box.bottom > boundary,
            );
            if (line < 0) continue;
            // A few pixels of clearance absorb the fractional sheet scale the
            // rules are painted with; the line gap is wider than this.
            shift =
              line === 0
                ? boundary + geometry.margin - contentTop
                : boundary + 4 - top - boxes[line].top;
          }
          if (shift <= 0) continue;
          snapBlock(block, index, shift);
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
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paginate);
    };

    schedule();
    editor.on("update", schedule);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(dom);
    // Front matter lives outside the editor but still consumes the first page.
    observer.observe(sheet);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      editor.off("update", schedule);
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
  } as CSSProperties;

  return (
    <div className="visual-editor-scroll" style={paperStyle}>
      <div className="paper-stack" aria-hidden="true" />
      <article
        className={`paper-sheet ${settings.paragraphSpacing === "gap" ? "paper-parskip" : ""}`}
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
