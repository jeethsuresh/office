import * as Y from "yjs";
import { BLOCK_META, type BlockKind, type SharedRecord } from "@office/model";
import { Plus } from "lucide-react";
export function Minimap({
  blocks,
  active,
  activeSlides,
  onNavigate,
  onAdd,
}: {
  blocks: SharedRecord[];
  active: string;
  activeSlides: Record<string, string>;
  onNavigate: (id: string, slide?: string) => void;
  onAdd: () => void;
}) {
  return (
    <aside className="minimap" aria-label="Document minimap">
      <span className="minimap-heading">MAP</span>
      <div className="minimap-track">
        {blocks.map((b, i) => {
          const kind = b.get("kind") as BlockKind;
          const slides =
            kind === "slides"
              ? (b.get("slides") as Y.Array<SharedRecord>).toArray()
              : [];
          return (
            <div
              key={b.get("id")}
              className={`minimap-segment ${active === b.get("id") ? "active" : ""}`}
              style={
                {
                  "--block-color": BLOCK_META[kind]?.color ?? "#888",
                } as React.CSSProperties
              }
            >
              <button
                className="minimap-block"
                onClick={() => onNavigate(b.get("id"))}
                aria-label={`Go to ${kind} block: ${b.get("title")}`}
                title={`${i + 1}. ${b.get("title")}`}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <i />
              </button>
              {kind === "slides" && (
                <div className="minimap-slides">
                  {slides.map((s, j) => (
                    <button
                      key={s.get("id")}
                      title={`Slide ${j + 1}: ${s.get("title")?.toString()}`}
                      aria-label={`Map: slide ${j + 1}`}
                      aria-current={activeSlides[b.get("id")] === s.get("id")}
                      onClick={() => onNavigate(b.get("id"), s.get("id"))}
                    >
                      <span>{j + 1}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    </aside>
  );
}
