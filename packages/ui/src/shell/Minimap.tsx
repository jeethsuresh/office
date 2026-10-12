import {
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import * as Y from "yjs";
import { BLOCK_META, type BlockKind, type SharedRecord } from "@office/model";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { MinimapSlides } from "./MinimapSlides";
import { BlockPreview } from "./BlockPreview";

export function Minimap({
  blocks,
  active,
  activeSlides,
  onNavigate,
  onAdd,
  onDelete,
  onUndo,
  className = "",
  label = "Document minimap",
}: {
  blocks: SharedRecord[];
  active: string;
  activeSlides: Record<string, string>;
  onNavigate: (id: string, slide?: string) => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  className?: string;
  label?: string;
}) {
  const tooltipID = useId();
  const [tooltip, setTooltip] = useState<{
    text: string;
    key: string;
    top: number;
  } | null>(null);
  function show(
    event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    key: string,
    text: string,
  ) {
    if ("pointerType" in event && event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      key,
      top: Math.max(
        12,
        Math.min(bounds.top + bounds.height / 2, innerHeight - 100),
      ),
    });
  }
  function hint(key: string, text: string) {
    return {
      title: text,
      "aria-describedby": tooltip?.key === key ? tooltipID : undefined,
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) =>
        show(event, key, text),
      onPointerLeave: () => setTooltip(null),
      onFocus: (event: FocusEvent<HTMLButtonElement>) => show(event, key, text),
      onBlur: () => setTooltip(null),
    };
  }
  return (
    <aside className={`minimap ${className}`} aria-label={label}>
      <span className="minimap-heading">MAP</span>
      <div className="minimap-track" onScroll={() => setTooltip(null)}>
        {blocks.map((block, index) => {
          const id = block.get("id") as string;
          const kind = block.get("kind") as BlockKind;
          const title = block.get("title") || "Untitled block";
          const slides =
            kind === "slides"
              ? (block.get("slides") as Y.Array<SharedRecord>).toArray()
              : [];
          return (
            <div
              key={id}
              className={`minimap-segment ${slides.length ? "minimap-deck" : ""} ${active === id ? "active" : ""}`}
              data-map-block={id}
              style={
                {
                  "--block-color": BLOCK_META[kind]?.color ?? "#888",
                  flexGrow: 1,
                  minHeight:
                    28 +
                    Math.min(5, slides.length) * 16 +
                    (slides.length > 5 ? 28 : 0),
                } as CSSProperties
              }
            >
              <button
                className="minimap-block"
                onClick={() => onNavigate(id)}
                aria-label={`Go to ${kind} block: ${title}`}
                aria-current={active === id && kind !== "slides"}
                {...hint(id, `${index + 1}. ${title}`)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span className="minimap-title">{title}</span>
                {kind !== "slides" && <BlockPreview block={block} />}
              </button>
              {!!slides.length && (
                <MinimapSlides
                  slides={slides}
                  title={title}
                  selected={activeSlides[id]}
                  active={active === id}
                  onNavigate={(slide) => onNavigate(id, slide)}
                  hint={hint}
                  onScroll={() => setTooltip(null)}
                />
              )}
            </div>
          );
        })}
      </div>
      {onAdd && (
        <>
          <div className="minimap-actions" aria-label="Block controls">
            <button
              className="minimap-add icon-button"
              aria-label="Add block from map"
              onClick={onAdd}
            >
              <Plus size={15} />
            </button>
            {onDelete && (
              <button
                className="minimap-delete icon-button"
                aria-label="Delete selected block from map"
                title="Delete selected block"
                disabled={!blocks.length}
                onClick={onDelete}
              >
                <Trash2 size={14} />
              </button>
            )}
            {onUndo && (
              <button
                className="minimap-undo icon-button"
                aria-label="Undo block change"
                title="Undo block change"
                onClick={onUndo}
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>
          <div className="minimap-legend">
            <i style={{ background: BLOCK_META.doc.color }} />
            <i style={{ background: BLOCK_META.slides.color }} />
            <i style={{ background: BLOCK_META.canvas.color }} />
          </div>
        </>
      )}
      {tooltip && (
        <div
          id={tooltipID}
          role="tooltip"
          className="minimap-tooltip"
          style={{ top: tooltip.top }}
        >
          {tooltip.text}
        </div>
      )}
    </aside>
  );
}
