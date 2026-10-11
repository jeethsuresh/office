import {
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import * as Y from "yjs";
import { BLOCK_META, type BlockKind, type SharedRecord } from "@office/model";
import { Plus } from "lucide-react";

export function Minimap({
  blocks,
  active,
  activeSlides,
  onNavigate,
  onAdd,
  className = "",
  label = "Document minimap",
}: {
  blocks: SharedRecord[];
  active: string;
  activeSlides: Record<string, string>;
  onNavigate: (id: string, slide?: string) => void;
  onAdd?: () => void;
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
              className={`minimap-segment ${active === id ? "active" : ""}`}
              style={
                {
                  "--block-color": BLOCK_META[kind]?.color ?? "#888",
                  flexGrow: 1 + slides.length,
                  minHeight: 28 + slides.length * 25,
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
                <i />
              </button>
              {!!slides.length && (
                <div
                  className="minimap-slides"
                  style={{ flexGrow: slides.length }}
                >
                  {slides.map((slide, slideIndex) => (
                    <button
                      key={slide.get("id")}
                      {...hint(
                        slide.get("id"),
                        `${title} · Slide ${slideIndex + 1}: ${slide.get("title")?.toString() || "Untitled slide"}`,
                      )}
                      aria-label={`Map: slide ${slideIndex + 1}`}
                      aria-current={
                        active === id &&
                        (activeSlides[id] ?? slides[0]?.get("id")) ===
                          slide.get("id")
                      }
                      onClick={() => onNavigate(id, slide.get("id"))}
                    >
                      <span>{slideIndex + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {onAdd && (
        <>
          <button
            className="minimap-add icon-button"
            aria-label="Add block from map"
            onClick={onAdd}
          >
            <Plus size={15} />
          </button>
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
