# Design tokens (Word 365 chrome)

The UI follows Word 365's neutral grey chrome with a blue accent, so a Word user
feels at home. These values live in `:root` in `src/styles.css` — anything new
uses the tokens, never a hard-coded colour.

| Token | Value | Use |
|---|---|---|
| `--chrome` | `#f3f2f1` | ribbon, top bar, status bar |
| `--chrome-strong` | `#edebe9` | hovered tab / pressed button |
| `--paper` | `#ffffff` | the page sheet |
| `--canvas` | `#e6e6e6` | area behind the page |
| `--line` | `#e1dfdd` | dividers, group borders |
| `--line-strong` | `#d2d0ce` | input borders |
| `--ink` | `#201f1e` | primary text |
| `--muted` | `#605e5c` | group labels, secondary text |
| `--faint` | `#8a8886` | disabled, placeholders |
| `--accent` | `#2b579a` | active tab, primary button, focus |
| `--accent-hover` | `#1f4278` | primary button hover |
| `--accent-soft` | `#deecf9` | selected rows, active toggle |
| `--danger` | `#a4262c` | destructive actions, errors |
| `--shadow-sheet` | 2px + 24px soft shadow | the paper sheet only |
| `--radius` | `4px` | Word's actual corner radius |

Typography: `"Segoe UI Variable Text", "Segoe UI Web (West European)", "Segoe UI",
system-ui, sans-serif`; chrome at 13px base, ribbon tabs 12px, group labels 9px
uppercase `--muted`. The **document** keeps its own serif typography — never
apply the chrome font to `article`/`.tiptap`.

Structure, top to bottom: top bar (40px) → tab strip (31px) → ribbon groups
(77px, divider between groups) → editor area → status bar (24px).

Rules for new UI:

- Icon-only buttons need `aria-label`; visible label sits under the icon in
  ribbon groups.
- Hover = `--chrome-strong`; pressed/active = `--accent-soft` or the accent
  underline on tabs; never a new shade.
- Dialogs: white surface, `--radius`, `--shadow-sheet`, backdrop `rgba(0,0,0,.25)`.
- Focus ring: 2px `--accent`, 1px offset — the existing `:focus-visible` rule.
- Any state that only exists in the browser (desktop-stub) must say so in the UI
  rather than pretending to work.
