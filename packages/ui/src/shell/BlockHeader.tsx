import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Layout,
  Menu,
  PenTool,
  Table2,
} from "lucide-react";
import { BLOCK_META, type BlockKind, type SharedRecord } from "@office/model";
import { BlockActionsSlot } from "../shared/BlockActions";
import { Backlinks, CopyReference } from "../shared/References";
import { useFullscreenController } from "../shared/Fullscreen";
import { BlockUpdated } from "./BlockUpdated";
import { ToolButton } from "../shared/Toolbar";
import { useBlockTools } from "../shared/WorkspaceTools";

const icons = { doc: FileText, canvas: PenTool, slides: Layout, sheet: Table2 };

export function BlockHeader({
  block,
  documentID,
  index,
  count,
  active,
  direction,
  previous,
  next,
  onNavigate,
}: {
  block: SharedRecord;
  documentID: string;
  index: number;
  count: number;
  active: boolean;
  direction?: "previous" | "next";
  previous?: SharedRecord;
  next?: SharedRecord;
  onNavigate: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const menuID = useId();
  const fullscreen = useFullscreenController();
  const tools = useBlockTools();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, height: 0 });
  const kind = block.get("kind") as BlockKind;
  const Icon = icons[kind] ?? FileText;
  const urn = `${documentID}:${block.get("id")}:_`;
  const title = block.get("title") || "Untitled block";
  const hidden = (!active && !direction) || !!fullscreen?.target;
  const identity = (
    <>
      <span
        className="block-type"
        title={BLOCK_META[kind]?.name}
        aria-label={`${BLOCK_META[kind]?.name} block`}
      >
        <Icon size={15} />
      </span>
      <span className="block-sequence">
        {String(index + 1).padStart(2, "0")} <i>/</i>{" "}
        {String(count).padStart(2, "0")}
      </span>
    </>
  );

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setCompact(element.clientWidth < 760);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    setOpen(false);
    // Fullscreen temporarily inerts siblings. Reapply the current state after
    // its cleanup so only active controls and neighboring navigation are usable.
    if (root.current) root.current.inert = hidden;
  }, [active, hidden, fullscreen?.target, compact]);

  useLayoutEffect(() => {
    if (!open || !compact || !trigger.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const width = Math.min(260, innerWidth - 16);
    const top = Math.min(bounds.bottom + 6, innerHeight - 48);
    setPosition({
      left: Math.max(8, Math.min(bounds.right - width, innerWidth - width - 8)),
      top,
      height: innerHeight - top - 8,
    });
    const frame = requestAnimationFrame(() => {
      actions.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, compact]);

  useLayoutEffect(() => {
    const panel = actions.current;
    if (!compact || !panel) return;
    // Editor actions reach this DOM node through portals. A native listener
    // handles those clicks as well as controls owned by the header itself.
    const clicked = (event: MouseEvent) => {
      const button = (event.target as Element).closest("button");
      if (!button || button.getAttribute("aria-label") === "Show backlinks")
        return;
      queueMicrotask(() => {
        setOpen(false);
        if (!root.current?.inert)
          trigger.current?.focus({ preventScroll: true });
      });
    };
    panel.addEventListener("click", clicked);
    return () => panel.removeEventListener("click", clicked);
  }, [compact]);

  useEffect(() => {
    if (!open) return;
    function close(restore = false) {
      setOpen(false);
      if (restore) trigger.current?.focus({ preventScroll: true });
    }
    const outside = (event: Event) => {
      const target = event.target as Node | null;
      if (
        !actions.current?.contains(target) &&
        !trigger.current?.contains(target)
      )
        close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(true);
        return;
      }
      if (!actions.current?.contains(document.activeElement)) return;
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const items = [
        ...actions.current.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ),
      ];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[next]?.focus({ preventScroll: true });
    };
    const resize = () => close();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={`block-heading ${compact ? "is-compact" : ""} ${!active && direction ? `is-${direction}` : ""}`}
      inert={hidden}
      aria-hidden={hidden}
      onFocusCapture={() => active && tools?.setFocused(tools.fallback)}
      onPointerDownCapture={() => active && tools?.setFocused(tools.fallback)}
    >
      {!active && direction ? (
        <button
          type="button"
          className={`block-peek block-header-navigation ${direction}`}
          title={title}
          aria-label={`Go to ${direction} block: ${title}`}
          onClick={() => onNavigate(block.get("id"))}
        >
          {identity}
          <span className="peek-title">{title}</span>
          {direction === "previous" ? (
            <ArrowUp size={15} />
          ) : (
            <ArrowDown size={15} />
          )}
        </button>
      ) : (
        <>
          {identity}
          <input
            className="block-title"
            aria-label={`${BLOCK_META[kind]?.name} block title`}
            value={block.get("title") ?? ""}
            onChange={(event) => block.set("title", event.target.value)}
          />
          <CopyReference urn={urn} label="Copy block reference" />
        </>
      )}
      <div
        ref={actions}
        id={menuID}
        className="block-heading-actions"
        hidden={!active || (compact && !open)}
        inert={!active}
        aria-hidden={!active}
        role={compact ? "dialog" : undefined}
        aria-label={compact ? "Block actions" : undefined}
        style={
          compact
            ? {
                left: position.left,
                top: position.top,
                maxHeight: position.height,
              }
            : undefined
        }
      >
        <BlockActionsSlot />
        {previous && (
          <ToolButton
            label={`Go to previous block: ${previous.get("title") || "Untitled block"}`}
            onClick={() => onNavigate(previous.get("id"))}
          >
            <ArrowUp size={16} />
          </ToolButton>
        )}
        {next && (
          <ToolButton
            label={`Go to next block: ${next.get("title") || "Untitled block"}`}
            onClick={() => onNavigate(next.get("id"))}
          >
            <ArrowDown size={16} />
          </ToolButton>
        )}
        <BlockUpdated block={block} />
        <Backlinks urn={urn} />
      </div>
      {compact && active && (
        <button
          ref={trigger}
          type="button"
          className="icon-button block-overflow"
          aria-label="More block actions"
          title="More block actions"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={menuID}
          onClick={() => setOpen((previous) => !previous)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <Menu size={16} />
        </button>
      )}
    </div>
  );
}
