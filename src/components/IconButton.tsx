import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
  compact?: boolean;
}

export default function IconButton({
  label,
  active = false,
  compact = false,
  children,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${compact ? "compact" : ""} ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      {...props}
    >
      {children}
    </button>
  );
}
