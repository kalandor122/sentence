import { ChevronDown, FileSliders, FileText, Type, UserRound, X } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { DOCUMENT_THEMES, activeDocumentTheme } from "../lib/themes";
import type { GitAuthor, ProjectSettings } from "../lib/types";

interface InspectorProps {
  open: boolean;
  settings: ProjectSettings;
  gitAuthor: GitAuthor;
  projectPath: string;
  onClose: () => void;
  onSettingsChange: (patch: Partial<ProjectSettings>) => void;
  onGitAuthorChange: (patch: Partial<GitAuthor>) => void;
}

export default function Inspector({
  open,
  settings,
  gitAuthor,
  projectPath,
  onClose,
  onSettingsChange,
  onGitAuthorChange,
}: InspectorProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open]);

  const activeTheme = activeDocumentTheme(settings);

  if (!open) return null;
  return (
    <aside className="inspector" role="dialog" aria-labelledby="inspector-title">
      <header className="inspector-header">
        <div>
          <span className="eyebrow">Project</span>
          <h2 id="inspector-title">Properties</h2>
        </div>
        <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Close properties"><X size={16} /></button>
      </header>
      <div className="inspector-scroll">
        <section className="inspector-section">
          <h3><FileSliders size={15} /> Document</h3>
          <label className="property-field"><span>Title</span><input value={settings.title} onChange={(event) => onSettingsChange({ title: event.target.value })} /></label>
          <label className="property-field"><span>Subtitle</span><input value={settings.subtitle} onChange={(event) => onSettingsChange({ subtitle: event.target.value })} /></label>
          <label className="property-field"><span>Authors, one per line</span><textarea rows={2} value={settings.author} placeholder={"Ada Lovelace\nGrace Hopper"} onChange={(event) => onSettingsChange({ author: event.target.value })} /></label>
          <label className="property-field"><span>Affiliation</span><input value={settings.affiliation} placeholder="University or laboratory" onChange={(event) => onSettingsChange({ affiliation: event.target.value })} /></label>
          <label className="property-field"><span>Contact email</span><input value={settings.email} placeholder="author@example.org" onChange={(event) => onSettingsChange({ email: event.target.value })} /></label>
          <label className="property-field"><span>Date</span><input value={settings.date} placeholder="Automatic" onChange={(event) => onSettingsChange({ date: event.target.value })} /></label>
          <label className="property-toggle">
            <input type="checkbox" checked={settings.includeToc} onChange={(event) => onSettingsChange({ includeToc: event.target.checked })} />
            <span>Generate table of contents</span>
          </label>
        </section>
        <section className="inspector-section">
          <h3><Type size={15} /> Styles</h3>
          <div className="theme-gallery" role="group" aria-label="Document theme">
            <span className="theme-gallery-label">Theme</span>
            <div className="theme-gallery-cards">
              {DOCUMENT_THEMES.map((theme) => {
                const active = activeTheme?.id === theme.id;
                const previewStyle = {
                  "--theme-font": theme.preview.fontFamily,
                  "--theme-font-size": theme.preview.fontSize,
                  "--theme-line-step": theme.preview.lineStep,
                  "--theme-margin": theme.preview.margin,
                  "--theme-paragraph-gap": theme.preview.paragraphGap,
                  "--theme-indent": theme.preview.indent,
                } as CSSProperties;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-card${active ? " active" : ""}`}
                    aria-pressed={active}
                    title={theme.description}
                    onClick={() => onSettingsChange(theme.settings)}
                  >
                    <span className="theme-preview" style={previewStyle} aria-hidden="true">
                      <span className="theme-preview-page">
                        <strong className="theme-preview-heading">Aa</strong>
                        <span className="theme-preview-paragraph">The quick brown fox jumps over the lazy dog.</span>
                        <span className="theme-preview-paragraph">A document can be shaped without writing LaTeX.</span>
                      </span>
                    </span>
                    <span className="theme-card-name">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="property-field">
            <span>Font family</span>
            <select
              value={settings.fontFamily}
              onChange={(event) => onSettingsChange({ fontFamily: event.target.value as ProjectSettings["fontFamily"] })}
            >
              <option value="default">Computer Modern</option>
              <option value="times">Times</option>
              <option value="palatino">Palatino</option>
            </select>
          </label>
          <label className="property-field">
            <span>Line spacing</span>
            <select
              value={settings.lineSpacing}
              onChange={(event) => onSettingsChange({ lineSpacing: event.target.value as ProjectSettings["lineSpacing"] })}
            >
              <option value="single">Single</option>
              <option value="onehalf">1.5 lines</option>
              <option value="double">Double</option>
            </select>
          </label>
          <label className="property-field">
            <span>Paragraph spacing</span>
            <select
              value={settings.paragraphSpacing}
              onChange={(event) => onSettingsChange({ paragraphSpacing: event.target.value as ProjectSettings["paragraphSpacing"] })}
            >
              <option value="indent">Indented paragraphs</option>
              <option value="gap">Spaced paragraphs</option>
            </select>
          </label>
        </section>
        <section className="inspector-section">
          <h3><FileText size={15} /> arXiv paper</h3>
          <label className="property-field">
            <span>Abstract</span>
            <textarea rows={6} value={settings.abstract} placeholder="Summarize the problem, method, and result." onChange={(event) => onSettingsChange({ abstract: event.target.value })} />
          </label>
          <label className="property-field"><span>Keywords</span><input value={settings.keywords} placeholder="machine learning, reproducibility" onChange={(event) => onSettingsChange({ keywords: event.target.value })} /></label>
          <label className="property-field">
            <span>Primary category</span>
            <input list="arxiv-categories" value={settings.primaryCategory} placeholder="cs.LG" onChange={(event) => onSettingsChange({ primaryCategory: event.target.value })} />
          </label>
          <label className="property-field">
            <span>Cross-list categories</span>
            <input list="arxiv-categories" value={settings.crossListCategories} placeholder="cs.AI, stat.ML" onChange={(event) => onSettingsChange({ crossListCategories: event.target.value })} />
          </label>
          <label className="property-field"><span>Submission comments</span><input value={settings.arxivComment} placeholder="12 pages, 4 figures" onChange={(event) => onSettingsChange({ arxivComment: event.target.value })} /></label>
          <datalist id="arxiv-categories">
            <option value="cs.AI" />
            <option value="cs.CL" />
            <option value="cs.CV" />
            <option value="cs.LG" />
            <option value="cs.SE" />
            <option value="cs.CR" />
            <option value="stat.ML" />
            <option value="math.NA" />
            <option value="math.OC" />
            <option value="eess.SP" />
            <option value="econ.EM" />
            <option value="q-bio.NC" />
            <option value="physics.comp-ph" />
          </datalist>
        </section>
        <section className="inspector-section">
          <h3><ChevronDown size={15} /> Page furniture</h3>
          <label className="property-field"><span>Header</span><input value={settings.header} placeholder="None" onChange={(event) => onSettingsChange({ header: event.target.value })} /></label>
          <label className="property-field"><span>Footer</span><input value={settings.footer} placeholder="Page number" onChange={(event) => onSettingsChange({ footer: event.target.value })} /></label>
        </section>
        <section className="inspector-section">
          <h3><UserRound size={15} /> Git identity</h3>
          <label className="property-field"><span>Name</span><input value={gitAuthor.name} placeholder="Your name" onChange={(event) => onGitAuthorChange({ name: event.target.value })} /></label>
          <label className="property-field"><span>Email</span><input value={gitAuthor.email} placeholder="you@example.com" onChange={(event) => onGitAuthorChange({ email: event.target.value })} /></label>
        </section>
        <section className="inspector-section">
          <h3>Location</h3>
          <code className="project-path">{projectPath || "Unsaved document"}</code>
        </section>
      </div>
    </aside>
  );
}
