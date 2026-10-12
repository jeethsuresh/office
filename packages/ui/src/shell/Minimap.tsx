import {
  useId,
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import * as Y from "yjs";
import { BLOCK_META, type BlockKind, type SharedRecord } from "@office/model";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { MinimapSlides } from "./MinimapSlides";
import { BlockPreview } from "./BlockPreview";
import { useMinimapDrag } from "./useMinimapDrag";
import { useMinimapMenu } from "./useMinimapMenu";

export function Minimap({
  blocks,
  active,
  activeSlides,
  onNavigate,
  onAdd,
  onDelete,
  onUndo,
  onMove,
  onAddAt,
  onDeleteBlock,
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
  onMove?: (block: string, before: string | null) => void;
  onAddAt?: (before: string | null) => void;
  onDeleteBlock?: (block: string) => void;
  className?: string;
  label?: string;
}) {
  const tooltipID = useId();
  const track = useRef<HTMLDivElement>(null);
  const drag = useMinimapDrag(track, onMove);
  const [tooltip, setTooltip] = useState<{
    text: string;
    key: string;
    top: number;
    left?: number;
    right?: number;
    maxWidth: number;
  } | null>(null);
  const context = useMinimapMenu(!!onDeleteBlock, () => {
    drag.cancel();
    setTooltip(null);
  });
  const menuBlock = blocks.find(
    (block) => block.get("id") === context.menu?.block,
  );
  useEffect(() => {
    if (context.menu && !menuBlock) context.close(false);
  }, [blocks.map((block) => block.get("id")).join(",")]);
  function show(
    event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    key: string,
    text: string,
  ) {
    if ("pointerType" in event && event.pointerType !== "mouse") return;
    if (context.menu) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const map = event.currentTarget
      .closest(".minimap")!
      .getBoundingClientRect();
    const onLeft = map.left >= innerWidth - map.right;
    const space = onLeft ? map.left - 24 : innerWidth - map.right - 24;
    setTooltip({
      text,
      key,
      top: Math.max(
        12,
        Math.min(bounds.top + bounds.height / 2, innerHeight - 100),
      ),
      left: onLeft ? undefined : map.right + 12,
      right: onLeft ? innerWidth - map.left + 12 : undefined,
      maxWidth: Math.min(330, Math.max(80, space)),
    });
  }
  function hint(key: string, text: string) {
    return {
      "aria-describedby": tooltip?.key === key ? tooltipID : undefined,
      onPointerEnter: (event: PointerEvent<HTMLButtonElement>) =>
        show(event, key, text),
      onPointerLeave: () => setTooltip(null),
      onFocus: (event: FocusEvent<HTMLButtonElement>) => show(event, key, text),
      onBlur: () => setTooltip(null),
    };
  }
  return (
    <aside
      className={`minimap ${onMove || onAddAt ? "is-editable" : ""} ${drag.dragging ? "is-dragging" : ""} ${className}`}
      aria-label={label}
    >
      <span className="minimap-heading">MAP</span>
      <div
        className="minimap-track"
        ref={track}
        onScroll={() => setTooltip(null)}
      >
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
              className={`minimap-segment ${slides.length ? "minimap-deck" : ""} ${active === id ? "active" : ""} ${drag.dragging === id ? "dragged" : ""}`}
              data-map-block={id}
              onContextMenu={(event) => context.context(event, id)}
              onKeyDownCapture={(event) => context.key(event, id)}
              onPointerDownCapture={(event) => context.start(event, id)}
              onPointerMoveCapture={context.move}
              onPointerUpCapture={context.release}
              onPointerCancelCapture={context.release}
              onClickCapture={(event) => context.click(event, id)}
              data-drop={
                drag.dragging
                  ? drag.before === id
                    ? "before"
                    : drag.before === null && index === blocks.length - 1
                      ? "after"
                      : undefined
                  : undefined
              }
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
                onClick={() => {
                  if (drag.click()) onNavigate(id);
                }}
                onPointerDown={(event) => drag.start(event, id)}
                onPointerMove={drag.move}
                onPointerUp={drag.finish}
                onPointerCancel={drag.cancel}
                onLostPointerCapture={drag.cancel}
                onKeyDown={(event) => {
                  if (
                    !onMove ||
                    !event.altKey ||
                    !["ArrowUp", "ArrowDown"].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  if (event.key === "ArrowUp" && index > 0)
                    onMove(id, blocks[index - 1].get("id"));
                  if (event.key === "ArrowDown" && index < blocks.length - 1)
                    onMove(id, blocks[index + 2]?.get("id") ?? null);
                }}
                aria-keyshortcuts={
                  onMove ? "Alt+ArrowUp Alt+ArrowDown" : undefined
                }
                aria-haspopup={onDeleteBlock ? "menu" : undefined}
                aria-expanded={
                  onDeleteBlock ? context.menu?.block === id : undefined
                }
                aria-label={`Go to ${kind} block: ${title}`}
                aria-current={active === id && kind !== "slides"}
                {...hint(id, `${index + 1}. ${title}`)}
              >
                <span className="minimap-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
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
                  contextMenuOpen={context.menu?.block === id}
                />
              )}
              {onAddAt && index < blocks.length - 1 && (
                <button
                  className="minimap-gap"
                  aria-label={`Add block before ${blocks[index + 1].get("title") || "next block"}`}
                  onClick={() => {
                    setTooltip(null);
                    onAddAt(blocks[index + 1].get("id"));
                  }}
                >
                  <span>
                    <Plus size={13} />
                  </span>
                </button>
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
      {tooltip && !drag.dragging && (
        <div
          id={tooltipID}
          role="tooltip"
          className="minimap-tooltip"
          style={{
            top: tooltip.top,
            left: tooltip.left ?? "auto",
            right: tooltip.right ?? "auto",
            maxWidth: tooltip.maxWidth,
          }}
        >
          {tooltip.text}
        </div>
      )}
      {context.menu && menuBlock && (
        <div
          ref={context.element}
          className="minimap-context-menu"
          role="menu"
          aria-label={`Block actions: ${menuBlock.get("title") || "Untitled block"}`}
          style={{ left: context.menu.left, top: context.menu.top }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              event.preventDefault();
              event.stopPropagation();
              context.close();
            }
            if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              context.element.current
                ?.querySelector<HTMLButtonElement>("button")
                ?.focus();
            }
          }}
        >
          <div className="minimap-context-heading">
            <span>
              {BLOCK_META[menuBlock.get("kind") as BlockKind]?.name} block
            </span>
            <strong>{menuBlock.get("title") || "Untitled block"}</strong>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              const id = context.menu!.block;
              context.close(false);
              onDeleteBlock?.(id);
            }}
          >
            <Trash2 size={15} />
            Delete block
          </button>
        </div>
      )}
    </aside>
  );
}
