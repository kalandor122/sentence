// Named document presets. Applying one writes the usual layout settings at
// once, so the visual editor and the LaTeX preamble stay in step. Preview
// values are deliberately small: they are only used by the style gallery cards.

import type { ProjectSettings } from "./types";

export const THEME_SETTING_KEYS = [
  "documentClass",
  "fontFamily",
  "fontSize",
  "lineSpacing",
  "paragraphSpacing",
  "margins",
] as const;

export type ThemeSettingKey = (typeof THEME_SETTING_KEYS)[number];
export type ThemeSettings = Pick<ProjectSettings, ThemeSettingKey>;

export interface ThemePreview {
  fontFamily: string;
  fontSize: string;
  lineStep: string;
  margin: string;
  paragraphGap: string;
  indent: string;
}

export interface DocumentTheme {
  id: string;
  label: string;
  description: string;
  settings: ThemeSettings;
  preview: ThemePreview;
}

const FONT_STACKS: Record<ProjectSettings["fontFamily"], string> = {
  default: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
  times: '"Times New Roman", Times, Georgia, serif',
  palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
};

const PREVIEW_FONT_PX: Record<ProjectSettings["fontSize"], number> = {
  "10pt": 5,
  "11pt": 6,
  "12pt": 7,
};

const PREVIEW_LINE_HEIGHT: Record<ProjectSettings["lineSpacing"], number> = {
  single: 1.35,
  onehalf: 1.9,
  double: 2.5,
};

const PREVIEW_MARGIN: Record<ProjectSettings["margins"], string> = {
  narrow: "4px",
  normal: "6px",
  wide: "9px",
};

function previewFor(settings: ThemeSettings): ThemePreview {
  return {
    fontFamily: FONT_STACKS[settings.fontFamily],
    fontSize: `${PREVIEW_FONT_PX[settings.fontSize]}px`,
    lineStep: `${Math.round(PREVIEW_FONT_PX[settings.fontSize] * PREVIEW_LINE_HEIGHT[settings.lineSpacing])}px`,
    margin: PREVIEW_MARGIN[settings.margins],
    paragraphGap: settings.paragraphSpacing === "gap" ? "4px" : "1px",
    indent: settings.paragraphSpacing === "indent" ? "4px" : "0px",
  };
}

function makeTheme(
  id: string,
  label: string,
  description: string,
  settings: ThemeSettings,
): DocumentTheme {
  return { id, label, description, settings, preview: previewFor(settings) };
}

export const DOCUMENT_THEMES: DocumentTheme[] = [
  makeTheme("classic", "Classic", "Computer Modern, 11 pt, single spacing, normal margins", {
    documentClass: "article",
    fontFamily: "default",
    fontSize: "11pt",
    lineSpacing: "single",
    paragraphSpacing: "indent",
    margins: "normal",
  }),
  makeTheme("modern", "Modern", "Palatino, 11 pt, 1.5 spacing, spaced paragraphs", {
    documentClass: "article",
    fontFamily: "palatino",
    fontSize: "11pt",
    lineSpacing: "onehalf",
    paragraphSpacing: "gap",
    margins: "normal",
  }),
  makeTheme("compact", "Compact", "Computer Modern, 10 pt, narrow margins", {
    documentClass: "article",
    fontFamily: "default",
    fontSize: "10pt",
    lineSpacing: "single",
    paragraphSpacing: "indent",
    margins: "narrow",
  }),
];

// The theme name is not stored separately: manual edits to any of the settings
// below simply leave no theme selected, which keeps source round-trips honest.
export function activeDocumentTheme(settings: ProjectSettings): DocumentTheme | null {
  return (
    DOCUMENT_THEMES.find((theme) =>
      THEME_SETTING_KEYS.every((key) => settings[key] === theme.settings[key]),
    ) ?? null
  );
}
