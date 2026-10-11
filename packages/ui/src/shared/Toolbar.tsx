import type { ReactNode } from "react";
export function ToolButton({
  label,
  active = false,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tool-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
