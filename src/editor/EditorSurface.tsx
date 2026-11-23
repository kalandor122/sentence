import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table, TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Citation,
  CommentMark,
  CrossReference,
  Footnote,
  InlineProjectImage,
  MathBlock,
  MathInline,
  PageBreak,
  ProjectImage,
  TableOfContents,
} from "./extensions";
import { FindHighlight } from "./find";
import { changeIndent } from "./indent";
import { LINE_HEIGHTS, LineSpacing, setLineSpacing } from "./lineSpacing";
import { pageBreakFill, pageCountFromBottom, pageGeometry } from "./pagination";
import {
  ColorMark,
  FontFamilyMark,
  FontSizeMark,
  HighlightMark,
} from "./textStyleMarks";
import type {
  CommentThread,
  ProjectSettings,
  SentenceDocument,
} from "../lib/types";

interface EditorSurfaceProps {
  document: SentenceDocument;
  settings: ProjectSettings;
  comments: CommentThread[];
  editable?: boolean;
  onUpdate: (document: SentenceDocument) => void;
  onReady: (editor: Editor | null) => void;
  onStateChange: () => void;
  onCommentSelected: (markId: string) => void;
  onEditMath: (latex: string, display: boolean) => void;
  onPageCountChange: (pages: number) => void;
}

const FONT_STACKS: Record<ProjectSettings["fontFamily"], string> = {
  default: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  times: '"Times New Roman", Times, Georgia, serif',
  palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
};

// Tab keeps keyboard focus in the page: it nests list items or indents a block,
// and Shift+Tab reverses the last step. Tables keep their own cell navigation.
const TabIndent = Extension.create({
  name: "sentenceTabIndent",
  priority: 200,
  addKeyboardShortcuts() {
    return {
      Tab: () => changeIndent(this.editor, false),
      "Shift-Tab": () => changeIndent(this.editor, true),
    };
  },
});

// Tables carry their caption as a node attribute so it survives the visual/LaTeX
// round trip without becoming a paragraph inside the table.
const CaptionTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") ?? "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
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

export default function EditorSurface({
  document,
  settings,
  comments,
  editable = true,
  onUpdate,
  onReady,
  onStateChange,
  onCommentSelected,
  onEditMath,
  onPageCountChange,
}: EditorSurfaceProps) {
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
      PageBreak,
      TableOfContents,
      CommentMark,
      FindHighlight,
      LineSpacing,
      TabIndent,
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
