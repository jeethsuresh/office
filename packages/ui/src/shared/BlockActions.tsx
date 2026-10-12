import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Undo2, Redo2, Trash2, Download } from "lucide-react";
import { ToolButton } from "./Toolbar";

const Context = createContext<{
  target: HTMLElement | null;
  setTarget: (element: HTMLSpanElement | null) => void;
  onDelete: () => void;
} | null>(null);

export function BlockActionsProvider({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const [target, setTarget] = useState<HTMLSpanElement | null>(null);
  return (
    <Context.Provider value={{ target, setTarget, onDelete }}>
      {children}
    </Context.Provider>
  );
}
export function BlockActionsSlot() {
  const scope = useContext(Context);
  return <span className="block-actions" ref={scope?.setTarget} />;
}
export function BlockActions({
  fullscreen,
  compact = false,
  undo,
  redo,
  download,
}: {
  fullscreen: boolean;
  compact?: boolean;
  undo: { label: string; run: () => void; disabled?: boolean };
  redo: { label: string; run: () => void; disabled?: boolean };
  download: { label: string; run: () => void };
}) {
  const scope = useContext(Context);
  const controls = (
    <>
      <ToolButton
        label={undo.label}
        onClick={undo.run}
        disabled={undo.disabled}
      >
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton
        label={redo.label}
        onClick={redo.run}
        disabled={redo.disabled}
      >
        <Redo2 size={16} />
      </ToolButton>
      {!compact && scope && (
        <ToolButton label="Delete block" onClick={scope.onDelete}>
          <Trash2 size={16} />
        </ToolButton>
      )}
      <ToolButton label={download.label} onClick={download.run}>
        <Download size={16} />
      </ToolButton>
    </>
  );
  return !compact && !fullscreen && scope
    ? scope.target
      ? createPortal(controls, scope.target)
      : null
    : controls;
}
export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
