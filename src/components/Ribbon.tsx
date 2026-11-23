import type { Editor } from "@tiptap/react";
import { useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  BookMarked,
  Braces,
  ChevronDown,
  Code2,
  Columns2,
  GitBranch,
  GitCommitHorizontal,
  Highlighter,
  Image,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTree,
  MessageSquareText,
  Monitor,
  PanelRight,
  Paperclip,
  Quote,
  Redo2,
  Sigma,
  SquareSplitHorizontal,
  Strikethrough,
  Table2,
  TextCursorInput,
  Trash2,
  Underline,
  Undo2,
  Upload,
  Download,
  FileArchive,
  FileCheck2,
  FileText,
} from "lucide-react";
import IconButton from "./IconButton";
import { changeIndent } from "../editor/indent";
import { toggleList } from "../editor/listToggle";
import type {
  EditorMode,
  ProjectSettings,
  RibbonTab,
} from "../lib/types";
import {
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  TEXT_FONTS,
  TEXT_SIZES,
  type TextColorOption,
} from "../lib/textStyles";

const TABS: RibbonTab[] = ["Home", "Insert", "Layout", "References", "Review", "Paper", "View", "Git"];

interface RibbonProps {
  editor: Editor | null;
  activeTab: RibbonTab;
  mode: EditorMode;
  settings: ProjectSettings;
  tracking: boolean;
  editorVersion: number;
  inspectorOpen: boolean;
  gitOpen: boolean;
  onTabChange: (tab: RibbonTab) => void;
  onModeChange: (mode: EditorMode) => void;
  onSettingsChange: (patch: Partial<ProjectSettings>) => void;
  onInsertImage: () => void;
  onInsertMath: (display: boolean) => void;
  onInsertCitation: () => void;
  onInsertFootnote: () => void;
  onInsertCrossReference: () => void;
  onInsertLink: () => void;
  onInsertToc: () => void;
  onInsertPageBreak: () => void;
  onToggleTracking: () => void;
  onAddComment: () => void;
  onOpenGit: () => void;
  onToggleInspector: () => void;
  onCompile: () => void;
  onExportArxiv: () => void;
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-actions">{children}</div>
      <span>{label}</span>
    </div>
  );
}

function styleValue(editor: Editor | null): string {
  if (!editor) return "paragraph";
  for (const level of [1, 2, 3]) {
    if (editor.isActive("heading", { level })) return `heading-${level}`;
  }
  return "paragraph";
}

function applyStyle(editor: Editor | null, value: string) {
  if (!editor) return;
  const chain = editor.chain().focus();
  if (value === "paragraph") chain.setParagraph().run();
  else chain.toggleHeading({ level: Number(value.slice(-1)) as 1 | 2 | 3 }).run();
}

function activeMarkAttribute(editor: Editor | null, markName: string, attribute: string): string {
  if (!editor) return "";
  const value = editor.getAttributes(markName)?.[attribute];
  return typeof value === "string" ? value : "";
}

function activeTextAlign(editor: Editor | null): string {
  if (!editor) return "";
  for (const align of ["center", "right", "justify"]) {
    if (editor.isActive({ textAlign: align })) return align;
  }
  // Plain paragraphs and headings have no textAlign attribute yet render left,
  // so Align left must read as pressed until another alignment is chosen.
  return editor.isActive("paragraph") || editor.isActive("heading") ? "left" : "";
}

interface ColorPaletteProps {
  label: string;
  noneLabel: string;
  icon: ReactNode;
  colors: TextColorOption[];
  activeColor: string;
  disabled?: boolean;
  onPick: (color: string | null) => void;
}

function ColorPalette({
  label,
  noneLabel,
  icon,
  colors,
  activeColor,
  disabled = false,
  onPick,
}: ColorPaletteProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="color-menu">
      <button
        type="button"
        className={`icon-button color-button ${activeColor ? "active" : ""}`}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon}
        <span className="color-bar" style={activeColor ? { background: activeColor } : undefined} />
      </button>
      {open ? (
        <>
          <div className="color-backdrop" onClick={() => setOpen(false)} />
          <div className="color-popover" role="menu" aria-label={label}>
            <button
              type="button"
              className="color-swatch none"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
            >
              {noneLabel}
            </button>
            {colors.map((color) => (
              <button
                key={color.key}
                type="button"
                className="color-swatch"
                style={{ background: color.key }}
                title={color.label}
                aria-label={color.label}
                onClick={() => {
                  onPick(color.key);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function Ribbon({
  editor,
  activeTab,
  mode,
  settings,
  tracking,
  editorVersion,
  inspectorOpen,
  gitOpen,
  onTabChange,
  onModeChange,
  onSettingsChange,
  onInsertImage,
  onInsertMath,
  onInsertCitation,
  onInsertFootnote,
  onInsertCrossReference,
  onInsertLink,
  onInsertToc,
  onInsertPageBreak,
  onToggleTracking,
  onAddComment,
  onOpenGit,
  onToggleInspector,
  onCompile,
  onExportArxiv,
}: RibbonProps) {
  void editorVersion;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const disabled = !editor;
  const textAlign = activeTextAlign(editor);
  const activeFont = activeMarkAttribute(editor, "fontFamily", "family");
  const activeSize = activeMarkAttribute(editor, "fontSize", "size");
  const activeTextColor = activeMarkAttribute(editor, "color", "color");
  const activeHighlight = activeMarkAttribute(editor, "highlight", "color");
  const readiness = [
    { label: "Title", ready: Boolean(settings.title.trim()) },
    { label: "Authors", ready: Boolean(settings.author.trim()) },
    { label: "Abstract", ready: Boolean(settings.abstract.trim()) },
    { label: "Category", ready: Boolean(settings.primaryCategory.trim()) },
  ];

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    onTabChange(TABS[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="ribbon" aria-label="Document commands">
      <nav className="ribbon-tabs" aria-label="Ribbon tabs" role="tablist">
        {TABS.map((tab, index) => {
          const selected = activeTab === tab;
          const tabId = `ribbon-tab-${tab.toLowerCase()}`;
          return (
            <button
              key={tab}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              aria-controls="ribbon-tabpanel"
              className={selected ? "active" : ""}
              onClick={() => onTabChange(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      <div
        className="ribbon-content"
        key={activeTab}
        role="tabpanel"
        id="ribbon-tabpanel"
        aria-labelledby={`ribbon-tab-${activeTab.toLowerCase()}`}
      >
        {activeTab === "Home" ? (
          <>
            <RibbonGroup label="Undo">
              <IconButton
                label="Undo (Ctrl+Z)"
                disabled={disabled || !editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 size={19} />
              </IconButton>
              <IconButton
                label="Redo (Ctrl+Y)"
                disabled={disabled || !editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 size={19} />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Font">
              <select
                className="ribbon-select font-select"
                value={TEXT_FONTS.some((font) => font.key === activeFont) ? activeFont : "default"}
                disabled={disabled}
                onChange={(event) => {
                  if (!editor) return;
                  if (event.target.value === "default") {
                    editor.chain().focus().unsetMark("fontFamily").run();
                  } else {
                    editor.chain().focus().setMark("fontFamily", { family: event.target.value }).run();
                  }
                }}
                aria-label="Font"
              >
                {TEXT_FONTS.map((font) => (
                  <option key={font.key} value={font.key}>{font.label}</option>
                ))}
              </select>
              <select
                className="ribbon-select size-select"
                value={TEXT_SIZES.some((size) => size.key === activeSize) ? activeSize : "normal"}
                disabled={disabled}
                onChange={(event) => {
                  if (!editor) return;
                  if (event.target.value === "normal") {
                    editor.chain().focus().unsetMark("fontSize").run();
                  } else {
                    editor.chain().focus().setMark("fontSize", { size: event.target.value }).run();
                  }
                }}
                aria-label="Font size"
              >
                {TEXT_SIZES.map((size) => (
                  <option key={size.key} value={size.key}>{size.label}</option>
                ))}
              </select>
              <ColorPalette
                label="Text color"
                noneLabel="No color"
                icon={<Baseline size={17} />}
                colors={TEXT_COLORS}
                activeColor={activeTextColor}
                disabled={disabled}
                onPick={(color) => {
                  if (!editor) return;
                  if (!color) editor.chain().focus().unsetMark("color").run();
                  else editor.chain().focus().setMark("color", { color }).run();
                }}
              />
              <ColorPalette
                label="Highlight"
                noneLabel="No highlight"
                icon={<Highlighter size={17} />}
                colors={HIGHLIGHT_COLORS}
                activeColor={activeHighlight}
                disabled={disabled}
                onPick={(color) => {
                  if (!editor) return;
                  if (!color) editor.chain().focus().unsetMark("highlight").run();
                  else editor.chain().focus().setMark("highlight", { color }).run();
                }}
              />
            </RibbonGroup>
            <RibbonGroup label="Format">
              <select
                className="ribbon-select style-select"
                value={styleValue(editor)}
                disabled={disabled}
                onChange={(event) => applyStyle(editor, event.target.value)}
                aria-label="Paragraph style"
              >
                <option value="paragraph">Normal text</option>
                <option value="heading-1">Title</option>
                <option value="heading-2">Heading 1</option>
                <option value="heading-3">Heading 2</option>
              </select>
              <IconButton label="Bold (Ctrl+B)" active={editor?.isActive("bold")} disabled={disabled} onClick={() => editor?.chain().focus().toggleBold().run()}>
                <Bold size={18} />
              </IconButton>
              <IconButton label="Italic (Ctrl+I)" active={editor?.isActive("italic")} disabled={disabled} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic size={18} />
              </IconButton>
              <IconButton label="Underline (Ctrl+U)" active={editor?.isActive("underline")} disabled={disabled} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                <Underline size={18} />
              </IconButton>
              <IconButton label="Strikethrough" active={editor?.isActive("strike")} disabled={disabled} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                <Strikethrough size={18} />
              </IconButton>
              <IconButton label="Inline code" active={editor?.isActive("code")} disabled={disabled} onClick={() => editor?.chain().focus().toggleCode().run()}>
                <Code2 size={18} />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              <IconButton label="Align left" active={textAlign === "left"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
                <AlignLeft size={18} />
              </IconButton>
              <IconButton label="Align center" active={textAlign === "center"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
                <AlignCenter size={18} />
              </IconButton>
              <IconButton label="Align right" active={textAlign === "right"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
                <AlignRight size={18} />
              </IconButton>
              <IconButton label="Justify" active={textAlign === "justify"} disabled={disabled} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}>
                <AlignJustify size={18} />
              </IconButton>
              <IconButton label="Bulleted list" active={editor?.isActive("bulletList")} disabled={disabled} onClick={() => editor && toggleList(editor, "bulletList")}>
                <List size={18} />
              </IconButton>
              <IconButton label="Numbered list" active={editor?.isActive("orderedList")} disabled={disabled} onClick={() => editor && toggleList(editor, "orderedList")}>
                <ListOrdered size={18} />
              </IconButton>
              <IconButton label="Increase indent (Tab)" aria-keyshortcuts="Tab" disabled={disabled || editor?.isActive("table") || editor?.isActive("codeBlock")} onClick={() => editor && changeIndent(editor, false)}>
                <IndentIncrease size={18} />
              </IconButton>
              <IconButton label="Decrease indent (Shift+Tab)" aria-keyshortcuts="Shift+Tab" disabled={disabled || editor?.isActive("table") || editor?.isActive("codeBlock")} onClick={() => editor && changeIndent(editor, true)}>
                <IndentDecrease size={18} />
              </IconButton>
              <IconButton label="Block quote" active={editor?.isActive("blockquote")} disabled={disabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                <Quote size={18} />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Links">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertLink}>
                <Link2 size={17} />
                <span>Add link</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Styles">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={() => applyStyle(editor, "heading-1")}>
                <TextCursorInput size={17} />
                <span>Apply heading</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "Insert" ? (
          <>
            <RibbonGroup label="Table">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <Table2 size={18} />
                <span>Insert table</span>
              </button>
              <IconButton label="Delete table" disabled={!editor?.isActive("table")} onClick={() => editor?.chain().focus().deleteTable().run()}>
                <Trash2 size={18} />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Media">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertImage}>
                <Image size={18} />
                <span>Image</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Mathematics">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={() => onInsertMath(false)}>
                <Sigma size={18} />
                <span>Inline equation</span>
              </button>
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={() => onInsertMath(true)}>
                <Braces size={18} />
                <span>Equation block</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="References">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertCitation}>
                <BookMarked size={18} />
                <span>Citation</span>
              </button>
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertFootnote}>
                <Paperclip size={18} />
                <span>Footnote</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Pages">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertPageBreak}>
                <SquareSplitHorizontal size={18} />
                <span>Page break</span>
              </button>
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertToc}>
                <ListTree size={18} />
                <span>Contents</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "Layout" ? (
          <>
            <RibbonGroup label="Page setup">
              <label className="ribbon-field">Size<select aria-label="Paper size" value={settings.paperSize} onChange={(event) => onSettingsChange({ paperSize: event.target.value as ProjectSettings["paperSize"] })}><option value="a4paper">A4</option><option value="letterpaper">Letter</option></select></label>
              <label className="ribbon-field">Margins<select aria-label="Margins" value={settings.margins} onChange={(event) => onSettingsChange({ margins: event.target.value as ProjectSettings["margins"] })}><option value="normal">Normal</option><option value="narrow">Narrow</option><option value="wide">Wide</option></select></label>
              <label className="ribbon-field">Text size<select aria-label="Text size" value={settings.fontSize} onChange={(event) => onSettingsChange({ fontSize: event.target.value as ProjectSettings["fontSize"] })}><option value="10pt">10 pt</option><option value="11pt">11 pt</option><option value="12pt">12 pt</option></select></label>
            </RibbonGroup>
            <RibbonGroup label="Document">
              <label className="ribbon-field">Type<select aria-label="Document class" value={settings.documentClass} onChange={(event) => onSettingsChange({ documentClass: event.target.value as ProjectSettings["documentClass"] })}><option value="article">Article</option><option value="report">Report</option><option value="book">Book</option></select></label>
              <IconButton label="Toggle line numbers" active={settings.lineNumbers} onClick={() => onSettingsChange({ lineNumbers: !settings.lineNumbers })}>
                <ListOrdered size={18} />
              </IconButton>
              <IconButton label="Document properties" active={inspectorOpen} onClick={onToggleInspector}>
                <PanelRight size={18} />
              </IconButton>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "References" ? (
          <>
            <RibbonGroup label="Citations">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertCitation}>
                <BookMarked size={18} />
                <span>Insert citation</span>
              </button>
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertCrossReference}>
                <Link2 size={18} />
                <span>Cross-reference</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Contents">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onInsertToc}>
                <ListTree size={18} />
                <span>Table of contents</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "Review" ? (
          <>
            <RibbonGroup label="Comments">
              <button type="button" className="ribbon-command wide" disabled={disabled} onClick={onAddComment}>
                <MessageSquareText size={18} />
                <span>New comment</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Tracking">
              <button type="button" className={`ribbon-command wide ${tracking ? "active" : ""}`} aria-pressed={tracking} onClick={onToggleTracking}>
                <ChevronDown size={17} />
                <span>{tracking ? "Tracking on" : "Track changes"}</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "Paper" ? (
          <>
            <RibbonGroup label="arXiv submission">
              <button type="button" className="ribbon-command wide" onClick={onExportArxiv}>
                <FileArchive size={18} />
                <span>Create arXiv ZIP</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Paper">
              <button type="button" className="ribbon-command wide" onClick={onToggleInspector}>
                <FileText size={18} />
                <span>Paper properties</span>
              </button>
              <button type="button" className="ribbon-command wide" onClick={onExportArxiv}>
                <FileCheck2 size={18} />
                <span>Submission check</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Required metadata">
              <div className="paper-readiness">
                {readiness.map((item) => (
                  <span key={item.label} className={item.ready ? "ready" : "missing"}>
                    <FileCheck2 size={13} />
                    {item.label}
                  </span>
                ))}
              </div>
            </RibbonGroup>
            <RibbonGroup label="Output">
              <button type="button" className="ribbon-command wide" onClick={onCompile}>
                <Download size={18} />
                <span>Compile PDF</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "View" ? (
          <>
            <RibbonGroup label="Editor mode">
              <button type="button" className={`ribbon-command wide ${mode === "visual" ? "active" : ""}`} aria-pressed={mode === "visual"} aria-keyshortcuts="Control+Alt+1" title="Visual (Ctrl+Alt+1)" onClick={() => onModeChange("visual")}>
                <Monitor size={18} />
                <span>Visual</span>
              </button>
              <button type="button" className={`ribbon-command wide ${mode === "source" ? "active" : ""}`} aria-pressed={mode === "source"} aria-keyshortcuts="Control+Alt+2" title="LaTeX (Ctrl+Alt+2)" onClick={() => onModeChange("source")}>
                <Code2 size={18} />
                <span>LaTeX</span>
              </button>
              <button type="button" className={`ribbon-command wide ${mode === "split" ? "active" : ""}`} aria-pressed={mode === "split"} aria-keyshortcuts="Control+Alt+3" title="Split (Ctrl+Alt+3)" onClick={() => onModeChange("split")}>
                <Columns2 size={18} />
                <span>Split</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Panels">
              <IconButton label="Document properties" active={inspectorOpen} onClick={onToggleInspector}>
                <PanelRight size={18} />
              </IconButton>
              <IconButton label="Git history" active={gitOpen} onClick={onOpenGit}>
                <GitBranch size={18} />
              </IconButton>
            </RibbonGroup>
            <RibbonGroup label="Output">
              <button type="button" className="ribbon-command wide" onClick={onCompile}>
                <Download size={18} />
                <span>Compile PDF</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        {activeTab === "Git" ? (
          <>
            <RibbonGroup label="Git">
              <button type="button" className="ribbon-command wide" onClick={onOpenGit}>
                <GitCommitHorizontal size={18} />
                <span>Changes and commit</span>
              </button>
              <button type="button" className="ribbon-command wide" onClick={onOpenGit}>
                <GitBranch size={18} />
                <span>Branches</span>
              </button>
            </RibbonGroup>
            <RibbonGroup label="Remote">
              <button type="button" className="ribbon-command wide" onClick={onOpenGit}>
                <Download size={18} />
                <span>Pull</span>
              </button>
              <button type="button" className="ribbon-command wide" onClick={onOpenGit}>
                <Upload size={18} />
                <span>Push</span>
              </button>
            </RibbonGroup>
          </>
        ) : null}

        <div className="ribbon-spacer" />
        <RibbonGroup label="Build">
          <button type="button" className="compile-button" onClick={onCompile}>
            <Download size={16} />
            Compile
          </button>
        </RibbonGroup>
      </div>
    </section>
  );
}
