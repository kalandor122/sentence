import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";

type DocumentNode = NodeViewProps["editor"]["state"]["doc"];

function footnoteMarker(doc: DocumentNode, pos: number | undefined): number {
  if (pos === undefined) return 1;
  let marker = 1;
  doc.descendants((node, nodePos) => {
    if (node.type.name === "footnote" && nodePos < pos) marker += 1;
    return true;
  });
  return marker;
}

function FootnoteNodeView({ editor, getPos, node }: NodeViewProps) {
  const text = typeof node.attrs.text === "string" ? node.attrs.text : "";
  const [marker, setMarker] = useState(() => footnoteMarker(editor.state.doc, getPos()));

  useEffect(() => {
    const refresh = () => setMarker(footnoteMarker(editor.state.doc, getPos()));
    refresh();
    editor.on("transaction", refresh);
    return () => {
      editor.off("transaction", refresh);
    };
  }, [editor, getPos]);

  return (
    <NodeViewWrapper
      as="sup"
      className="footnote"
      data-footnote=""
      data-text={text}
      title={text}
      aria-label={`Footnote ${marker}${text ? `: ${text}` : ""}`}
      contentEditable={false}
    >
      {marker}
    </NodeViewWrapper>
  );
}

export function footnoteNodeView() {
  return ReactNodeViewRenderer(FootnoteNodeView);
}
