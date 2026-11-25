import type { Editor } from "@tiptap/react";

// Focus handoff for keys that leave the editing surface (Escape, Tab at the
// edge of a table). Controls are looked up on demand so panels and dialogs
// that appear later are still reachable, and wrapping keeps the page from
// stranding the keyboard when nothing sits on one side of it.
function controlsAround(editor: Editor): HTMLElement[] {
  const dom = editor.view.dom;
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex >= 0 &&
      element.getClientRects().length > 0 &&
      !dom.contains(element),
  );
}

function focusControl(editor: Editor, forward: boolean): boolean {
  const dom = editor.view.dom;
  const controls = controlsAround(editor);
  const ordered = forward ? controls : [...controls].reverse();
  const next =
    ordered.find(
      (element) =>
        dom.compareDocumentPosition(element) &
        (forward ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING),
    ) ?? ordered[0];
  if (!next) return false;
  next.focus();
  return true;
}

// Hand focus to the next control after the page, wrapping to the first one, so
// Escape from the editing surface always lands on something the keyboard can use.
export function focusAfterEditor(editor: Editor): boolean {
  return focusControl(editor, true);
}

export function focusBeforeEditor(editor: Editor): boolean {
  return focusControl(editor, false);
}
