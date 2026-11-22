import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import type { RefObject } from "react";
import IconButton from "./IconButton";

interface FindBarProps {
  query: string;
  replacement: string;
  showReplace: boolean;
  position: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onToggleReplace: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export default function FindBar({
  query,
  replacement,
  showReplace,
  position,
  inputRef,
  onQueryChange,
  onReplacementChange,
  onToggleReplace,
  onNext,
  onPrevious,
  onReplace,
  onReplaceAll,
  onClose,
}: FindBarProps) {
  const noMatches = position === "No matches";

  return (
    <div
      className="find-bar"
      role="search"
      aria-label="Find in document"
    >
      <div className="find-bar-row">
        <Replace size={14} className="find-bar-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Find"
          placeholder="Find"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          }}
        />
        <span className="find-count" aria-live="polite">{position}</span>
        <IconButton label="Previous match" compact disabled={noMatches} onClick={onPrevious}>
          <ChevronUp size={14} />
        </IconButton>
        <IconButton label="Next match" compact disabled={noMatches} onClick={onNext}>
          <ChevronDown size={14} />
        </IconButton>
        <IconButton
          label={showReplace ? "Hide replace" : "Show replace"}
          compact
          active={showReplace}
          aria-expanded={showReplace}
          onClick={onToggleReplace}
        >
          <Replace size={14} />
        </IconButton>
        <IconButton label="Close find" compact onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      {showReplace ? (
        <div className="find-bar-row">
          <input
            type="text"
            aria-label="Replace with"
            placeholder="Replace with"
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onReplace();
            }}
          />
          <button className="secondary-button small" type="button" disabled={noMatches} onClick={onReplace}>
            Replace
          </button>
          <button className="secondary-button small" type="button" disabled={noMatches} onClick={onReplaceAll}>
            Replace all
          </button>
        </div>
      ) : null}
    </div>
  );
}
