import type {
  GitState,
  ProjectSettings,
  SentenceDocument,
} from "./types";

export const DEFAULT_SETTINGS: ProjectSettings = {
  title: "Untitled document",
  author: "",
  affiliation: "",
  email: "",
  subtitle: "",
  date: "",
  abstract: "",
  keywords: "",
  primaryCategory: "",
  crossListCategories: "",
  arxivComment: "",
  documentClass: "article",
  paperSize: "a4paper",
  fontSize: "11pt",
  margins: "normal",
  fontFamily: "default",
  lineSpacing: "single",
  paragraphSpacing: "indent",
  paragraphSpaceBefore: 0,
  paragraphSpaceAfter: 10,
  columns: "one",
  includeToc: false,
  header: "",
  footer: "",
  lineNumbers: false,
  spellcheck: true,
  preamble: "",
};

export const EMPTY_GIT_STATE: GitState = {
  isRepository: false,
  status: {
    branch: "main",
    detached: false,
    ahead: 0,
    behind: 0,
    changes: [],
    remoteUrl: null,
  },
  history: [],
  branches: [],
};

export function createWelcomeDocument(title = "Untitled document"): SentenceDocument {
  void title;
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Introduction" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Start with the problem, the gap, and the contribution. The title, authors, and abstract live in Paper properties.",
          },
        ],
      },
    ],
  };
}

export const DEMO_DOCUMENT: SentenceDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
        content: [{ type: "text", text: "Introduction" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "A sentence is not merely ",
        },
        {
          type: "text",
          marks: [{ type: "italic" }],
          text: "a container for information",
        },
        {
          type: "text",
          text: ". It is a small structure of attention, carrying an idea from one mind into another.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Drafting with constraints" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          marks: [{ type: "comment", attrs: { markId: "demo-comment" } }],
          text: "Good tools stay close to the work. They make the structure visible without turning every decision into ceremony. A paragraph should feel like a paragraph, a table like a table, and the source should remain legible to both people and machines.",
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Clarity arrives when the mechanics disappear and only the thought remains.",
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The central model can be expressed compactly: " },
        {
          type: "text",
          marks: [{ type: "code" }],
          text: "meaning = structure + language",
        },
        { type: "text", text: "." },
      ],
    },
  ],
};
