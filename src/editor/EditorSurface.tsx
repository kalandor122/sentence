import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  Citation,
  CommentMark,
  CrossReference,
  Footnote,
  MathBlock,
  MathInline,
  PageBreak,
  ProjectImage,
  TableOfContents,
} from "./extensions";
import { FindHighlight } from "./find";
import { changeIndent } from "./indent";
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

const LINE_HEIGHTS: Record<ProjectSettings["lineSpacing"], string> = {
  single: "1.72",
  onehalf: "2.15",
  double: "2.6",
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

// Visual pagination constants (layout px, unscaled by the editor zoom).
const PAGE_HEIGHT = 1053;
const PAGE_GAP = 64;

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
      Placeholder.configure({
        placeholder: "Begin with a sentence...",
        showOnlyWhenEditable: true,
      }),
      Subscript,
      Superscript,
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
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
      TabIndent,
    ],
    content: document,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "sentence-editor",
        spellcheck: "true",
        autocorrect: "on",
        "aria-label": "Document editor",
      },
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
    onUpdate: ({ editor: current, transaction }) => {
      const json = current.getJSON() as SentenceDocument;
      const empty = (json.content ?? []).every(
        (node) => node.type === "paragraph" && !(node.content ?? []).length,
      );
      // React StrictMode double-mounts in dev: the discarded instance syncs the
      // real document, the live one starts empty and emits that empty doc, which
      // used to overwrite the workspace on every switch out of LaTeX source.
      // Those setup transactions carry no edit steps. Focus is unreliable here:
      // Tiptap defers focus from toolbar commands, so a Delete table click emits
      // a real one-step edit while the editor is still unfocused.
      if (empty && transaction.steps.length === 0) return;
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
    const dom = editor.view.dom as HTMLElement;
    const sheet = dom.closest<HTMLElement>(".paper-sheet");
    const scroll = dom.closest<HTMLElement>(".visual-editor-scroll");
    if (!sheet || !scroll) {
      onPageCountChange(1);
      return;
    }
    let frame = 0;
    let lastPages = 0;

    const paginate = () => {
      frame = 0;
      const wrappers = Array.from(dom.querySelectorAll<HTMLElement>("[data-page-break]"));
      scroll.style.removeProperty("--sentence-sheet-min-height");
      for (const wrapper of wrappers) wrapper.style.paddingTop = "0px";
      if (wrappers.length > 0) {
        for (const wrapper of wrappers) {
          const remainder = (offsetWithin(wrapper, sheet) + PAGE_GAP) % PAGE_HEIGHT;
          const fill = remainder === 0 ? 0 : PAGE_HEIGHT - remainder;
          wrapper.style.paddingTop = `${fill}px`;
        }
      }
      const contentBottom = offsetWithin(dom, sheet) + dom.offsetHeight;
      const pages = Math.max(1, Math.ceil(contentBottom / PAGE_HEIGHT));
      scroll.style.setProperty(
        "--sentence-sheet-min-height",
        `${pages * PAGE_HEIGHT}px`,
      );
      if (pages !== lastPages) {
        lastPages = pages;
        onPageCountChange(pages);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paginate);
    };

    schedule();
    editor.on("update", schedule);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(dom);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      editor.off("update", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      scroll.style.removeProperty("--sentence-sheet-min-height");
      for (const wrapper of dom.querySelectorAll<HTMLElement>("[data-page-break]")) {
        wrapper.style.paddingTop = "";
      }
    };
  }, [editor, settings, comments, onPageCountChange]);

  const paperStyle = {
    "--paper-font": FONT_STACKS[settings.fontFamily],
    "--paper-line-height": LINE_HEIGHTS[settings.lineSpacing],
  } as CSSProperties;

  return (
    <div className="visual-editor-scroll">
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
        <EditorContent editor={editor} />
      </article>
    </div>
  );
}
