import { useEffect, useRef, useState, type PointerEvent } from "react";
import * as Y from "yjs";
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  MoveUpRight,
  Pencil,
  Type,
  Trash2,
  ZoomIn,
  ZoomOut,
  Scan,
  MapPin,
  Link2,
  ExternalLink,
} from "lucide-react";
import {
  LOCAL_ORIGIN,
  makeUndoManager,
  putShape,
  updateShape,
  shapeValues,
  type SharedRecord,
  type Shape,
  type ShapeKind,
} from "@office/model";
import type { DocumentSession } from "@office/collaboration";
import { useShared, useSession } from "../shared/hooks";
import { ToolButton } from "../shared/Toolbar";
import { Modal } from "../shared/Modal";
import { EditorTools, useEditorFullscreen } from "../shared/Fullscreen";
import {
  CopyReference,
  ReferencePicker,
  ReferenceChip,
  SlashPopover,
  type SlashState,
  referenceText,
  referenceTitle,
} from "../shared/References";
import { useOfficeData, useOfficeRevision } from "../shared/OfficeData";
import type { Target } from "@office/model";
import { BlockActions } from "../shared/BlockActions";
type Tool = "select" | "hand" | ShapeKind;
const palette = [
  "#3e4147",
  "#4f83cf",
  "#cf6658",
  "#a08027",
  "#6d947d",
  "#9a78b1",
];
function ShapeView({
  shape,
  selected,
  linkedLabel,
  linkedTitle,
}: {
  shape: Shape;
  selected: boolean;
  linkedLabel?: string;
  linkedTitle?: string;
}) {
  const { x, y, width: w, height: h, color, fill } = shape;
  const stroke = { stroke: color, strokeWidth: 2.5, fill };
  const label =
    shape.text && shape.kind !== "text" && shape.kind !== "pin" ? (
      <text
        x={x + w / 2}
        y={y + h / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fill={color}
        fontSize={22}
      >
        {shape.text}
      </text>
    ) : null;
  return (
    <g
      data-shape-id={shape.id}
      data-office-anchor={shape.id}
      className={`canvas-shape ${shape.kind === "pin" ? "canvas-pin" : ""}`}
    >
      {shape.kind === "pin" && (
        <g>
          {linkedTitle && <title>{linkedTitle}</title>}
          <path
            d={`M${x} ${y} C${x - 8} ${y - 12},${x - 20} ${y - 24},${x - 20} ${y - 36} A20 20 0 1 1 ${x + 20} ${y - 36} C${x + 20} ${y - 24},${x + 8} ${y - 12},${x} ${y}`}
            fill={color}
            stroke="#fffdf8"
            strokeWidth={2}
          />
          <circle cx={x} cy={y - 36} r={6} fill="#fffdf8" />
          <text x={x + 30} y={y - 31} fill={color} fontSize={18}>
            {linkedLabel || shape.text || "Pin"}
          </text>
        </g>
      )}
      {shape.kind === "rect" && (
        <rect
          x={Math.min(x, x + w)}
          y={Math.min(y, y + h)}
          width={Math.abs(w)}
          height={Math.abs(h)}
          rx="12"
          {...stroke}
        />
      )}
      {shape.kind === "ellipse" && (
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={Math.abs(w / 2)}
          ry={Math.abs(h / 2)}
          {...stroke}
        />
      )}
      {shape.kind === "arrow" && (
        <g stroke={color} fill="none" strokeWidth="2.5">
          <path d={`M${x} ${y} L${x + w} ${y + h}`} />
          <path
            d={`M${x + w - 16 * Math.cos(Math.atan2(h, w) - 0.45)} ${y + h - 16 * Math.sin(Math.atan2(h, w) - 0.45)} L${x + w} ${y + h} L${x + w - 16 * Math.cos(Math.atan2(h, w) + 0.45)} ${y + h - 16 * Math.sin(Math.atan2(h, w) + 0.45)}`}
          />
          <path
            d={`M${x} ${y} L${x + w} ${y + h}`}
            stroke="transparent"
            strokeWidth="16"
          />
        </g>
      )}
      {shape.kind === "pen" && (
        <path
          d={shape.points
            ?.map((p, i) => `${i ? "L" : "M"}${x + p[0]} ${y + p[1]}`)
            .join(" ")}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {shape.kind === "text" && (
        <text x={x} y={y + 25} fill={color} fontSize="25" fontFamily="inherit">
          {shape.text?.split("\n").map((line, i) => (
            <tspan key={i} x={x} dy={i ? 32 : 0}>
              {line}
            </tspan>
          ))}
        </text>
      )}
      {label}
      {selected && (
        <rect
          className="selection-rect"
          x={Math.min(x, x + w) - 7}
          y={Math.min(y, y + h) - 7}
          width={Math.max(20, Math.abs(w)) + 14}
          height={Math.max(30, Math.abs(h)) + 14}
          rx="4"
          fill="none"
          stroke="#4f83cf"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
      )}
    </g>
  );
}
export function CanvasEditor({
  shapes,
  session,
  scope,
  compact = false,
  readOnly = false,
}: {
  shapes: Y.Map<SharedRecord>;
  session: DocumentSession;
  scope: string;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const data = useOfficeData();
  useOfficeRevision();
  const fullscreen = useEditorFullscreen(
    `${compact ? "slide" : "block"}:${scope}${compact ? ":canvas" : ""}`,
  );
  useShared(shapes);
  useSession(session);
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(palette[0]);
  const [fill, setFill] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: 1200, h: 650 });
  const [text, setText] = useState<{
    x: number;
    y: number;
    value: string;
    id?: string;
  } | null>(null);
  const [pin, setPin] = useState<{
    x: number;
    y: number;
    id?: string;
    label: string;
    link: string;
  } | null>(null);
  const [pinPicker, setPinPicker] = useState(false);
  const [slash, setSlash] = useState<SlashState | null>(null);
  let blockOwner: any = shapes.parent;
  while (blockOwner && !blockOwner.get?.("kind"))
    blockOwner = blockOwner.parent;
  const blockID = blockOwner?.get("id") ?? scope;
  const gesture = useRef<{
    x: number;
    y: number;
    shape?: Shape;
    pan?: typeof view;
    tool: Tool;
  } | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const undo = useRef<Y.UndoManager | null>(null);
  useEffect(() => {
    undo.current = makeUndoManager(shapes);
    return () => {
      undo.current?.destroy();
    };
  }, [shapes]);
  useEffect(() => {
    const focus = (event: Event) => {
      const target = (event as CustomEvent<Target>).detail;
      if (
        target.document !== session.id ||
        target.block !== blockID ||
        target.kind !== "pin" ||
        (target.slide && target.slide !== scope)
      )
        return;
      const shape = shapes.get(target.identifier)?.toJSON() as
        Shape | undefined;
      if (shape) {
        setSelected(shape.id);
        setView({
          x: shape.x - 400,
          y: shape.y - 220,
          w: 800,
          h: (800 * 650) / 1200,
        });
        svg.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("office:focus-target", focus);
    return () => window.removeEventListener("office:focus-target", focus);
  }, [shapes, blockID, scope, session.id]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (readOnly) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey) zoom(event.deltaY > 0 ? 1.06 : 0.94);
      else {
        const unit =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? element.clientHeight
              : 1;
        const scale = element.getScreenCTM()?.a || 1;
        setView((v) => ({
          ...v,
          x: v.x + (event.deltaX * unit) / scale,
          y: v.y + (event.deltaY * unit) / scale,
        }));
      }
    };
    // React wheel listeners are passive; a native listener owns the gesture.
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [readOnly]);
  function point(event: { clientX: number; clientY: number }) {
    const element = svg.current!;
    const p = element.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const mapped = p.matrixTransform(element.getScreenCTM()!.inverse());
    return { x: mapped.x, y: mapped.y };
  }
  function erase() {
    undo.current?.stopCapturing();
    if (selected)
      shapes.doc?.transact(() => shapes.delete(selected), LOCAL_ORIGIN);
    setSelected(null);
    undo.current?.stopCapturing();
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    if (readOnly || e.button !== 0) return;
    svg.current!.focus();
    const p = point(e);
    const id = (e.target as Element)
      .closest("[data-shape-id]")
      ?.getAttribute("data-shape-id");
    svg.current!.setPointerCapture(e.pointerId);
    undo.current?.stopCapturing();
    if (tool === "hand" || e.altKey) {
      gesture.current = { ...p, pan: view, tool: "hand" };
      return;
    }
    if (tool === "select") {
      setSelected(id ?? null);
      const shape = id ? (shapes.get(id)?.toJSON() as Shape) : undefined;
      gesture.current = { ...p, shape, tool };
      return;
    }
    if (tool === "text") {
      setText({ ...p, value: "" });
      return;
    }
    if (tool === "pin") {
      setPin({ ...p, label: "", link: "" });
      return;
    }
    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: tool,
      x: p.x,
      y: p.y,
      width: 0,
      height: 0,
      color,
      fill: fill ? `${color}22` : "none",
      ...(tool === "pen" ? { points: [[0, 0]] } : {}),
    };
    draftRef.current = shape;
    setDraft(shape);
    gesture.current = { ...p, tool };
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (readOnly) return;
    const p = point(e);
    session.awareness.setLocalStateField("canvas", { scope, x: p.x, y: p.y });
    const g = gesture.current;
    if (!g) return;
    if (g.pan) {
      setView((v) => ({ ...v, x: v.x + g.x - p.x, y: v.y + g.y - p.y }));
      return;
    }
    if (g.tool === "select" && g.shape) {
      updateShape(shapes, g.shape.id, {
        x: g.shape.x + p.x - g.x,
        y: g.shape.y + p.y - g.y,
      });
      return;
    }
    if (draftRef.current) {
      const next = { ...draftRef.current, width: p.x - g.x, height: p.y - g.y };
      if (next.kind === "pen")
        next.points = [...(next.points ?? []), [p.x - g.x, p.y - g.y]];
      draftRef.current = next;
      setDraft(next);
    }
  }
  function up() {
    const shape = draftRef.current;
    if (shape && (Math.abs(shape.width) > 3 || Math.abs(shape.height) > 3)) {
      putShape(shapes, shape);
      setSelected(shape.id);
      if (tool !== "pen") setTool("select");
    }
    draftRef.current = null;
    setDraft(null);
    gesture.current = null;
    undo.current?.stopCapturing();
  }
  function zoom(factor: number) {
    setView((v) => {
      const w = Math.max(180, Math.min(12000, v.w * factor));
      const h = (w * 650) / 1200;
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });
  }
  function fit() {
    const list = shapeValues(shapes);
    if (!list.length) {
      setView({ x: 0, y: 0, w: 1200, h: 650 });
      return;
    }
    const x = Math.min(...list.map((s) => Math.min(s.x, s.x + s.width))) - 70,
      y = Math.min(...list.map((s) => Math.min(s.y, s.y + s.height))) - 70;
    const right =
        Math.max(...list.map((s) => Math.max(s.x, s.x + s.width))) + 70,
      bottom = Math.max(...list.map((s) => Math.max(s.y, s.y + s.height))) + 70;
    const w = Math.max(right - x, ((bottom - y) * 1200) / 650, 400);
    setView({ x, y, w, h: (w * 650) / 1200 });
  }
  function download() {
    const copy = svg.current!.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", "1200");
    copy.setAttribute("height", "650");
    copy
      .querySelectorAll(".selection-rect,.canvas-cursor")
      .forEach((el) => el.remove());
    const url = URL.createObjectURL(
      new Blob([copy.outerHTML], { type: "image/svg+xml" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "office-canvas.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const cursors = [...session.awareness.getStates()].filter(
    ([id, state]) =>
      id !== session.doc.clientID && state.canvas?.scope === scope,
  );
  return (
    <div
      ref={fullscreen.ref}
      className={`canvas-editor ${compact ? "compact" : ""} ${fullscreen.className}`}
    >
      {!readOnly && (
        <EditorTools
          className="canvas-tools"
          label="Canvas tools"
          fullscreen={fullscreen}
          fullscreenLabel={
            compact ? "Fullscreen slide canvas" : "Fullscreen canvas"
          }
        >
          {(
            [
              { id: "select", label: "Select (V)", icon: MousePointer2 },
              { id: "hand", label: "Pan (H)", icon: Hand },
              { id: "rect", label: "Rectangle (R)", icon: Square },
              { id: "ellipse", label: "Ellipse (O)", icon: Circle },
              { id: "arrow", label: "Arrow (A)", icon: MoveUpRight },
              { id: "pen", label: "Draw (P)", icon: Pencil },
              { id: "text", label: "Text (T)", icon: Type },
              { id: "pin", label: "Pin (I)", icon: MapPin },
            ] as const
          ).map((item) => (
            <ToolButton
              key={item.id}
              label={item.label}
              active={tool === item.id}
              onClick={() => setTool(item.id)}
            >
              <item.icon size={18} />
            </ToolButton>
          ))}
          {selected && shapes.get(selected)?.get("kind") === "pin" && (
            <>
              <ToolButton
                label="Edit selected pin"
                onClick={() => {
                  const shape = shapes.get(selected)!.toJSON() as Shape;
                  setPin({
                    x: shape.x,
                    y: shape.y,
                    id: shape.id,
                    label: shape.text ?? "Pin",
                    link: shape.link ?? "",
                  });
                }}
              >
                <Link2 size={17} />
              </ToolButton>
              <CopyReference
                urn={`${session.id}:${blockID}:${selected}`}
                label="Copy pin reference"
              />
              {shapes.get(selected)?.get("link") && (
                <ToolButton
                  label="Open pin target"
                  onClick={() =>
                    void data.open(shapes.get(selected!)!.get("link"))
                  }
                >
                  <ExternalLink size={17} />
                </ToolButton>
              )}
            </>
          )}
          <span className="tool-divider" />
          <div className="color-palette">
            {palette.map((c) => (
              <button
                key={c}
                className={`color-dot ${color === c ? "chosen" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                title={`Color ${c}`}
                onClick={() => {
                  setColor(c);
                  if (selected)
                    updateShape(shapes, selected, {
                      color: c,
                      fill: fill ? `${c}22` : "none",
                    });
                }}
              />
            ))}
          </div>
          <ToolButton
            label="Filled shapes"
            active={fill}
            onClick={() => {
              setFill(!fill);
              if (selected)
                updateShape(shapes, selected, {
                  fill: !fill ? `${color}22` : "none",
                });
            }}
          >
            <Square size={16} fill={fill ? color : "none"} />
          </ToolButton>
          <span className="tool-divider" />
          <BlockActions
            fullscreen={fullscreen.active}
            compact={compact}
            undo={{
              label: "Undo canvas",
              run: () => {
                undo.current?.undo();
              },
            }}
            redo={{
              label: "Redo canvas",
              run: () => {
                undo.current?.redo();
              },
            }}
            download={{ label: "Download canvas", run: download }}
          />
          <ToolButton
            label="Delete selected shape"
            disabled={!selected}
            onClick={erase}
          >
            <Trash2 size={16} />
          </ToolButton>
          <ToolButton label="Zoom in" onClick={() => zoom(0.8)}>
            <ZoomIn size={17} />
          </ToolButton>
          <output
            className="canvas-zoom"
            aria-label="Canvas zoom level"
            aria-live="polite"
          >
            {Math.round((1200 / view.w) * 100)}%
          </output>
          <ToolButton label="Zoom out" onClick={() => zoom(1.25)}>
            <ZoomOut size={17} />
          </ToolButton>
          <ToolButton label="Fit canvas" onClick={fit}>
            <Scan size={17} />
          </ToolButton>
        </EditorTools>
      )}
      <div className="canvas-workspace">
        <svg
          ref={svg}
          className={`drawing-surface tool-${tool}`}
          tabIndex={readOnly ? -1 : 0}
          aria-label="Drawing workspace"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={() =>
            session.awareness.setLocalStateField("canvas", null)
          }
          onDoubleClick={(e) => {
            const id = (e.target as Element)
              .closest("[data-shape-id]")
              ?.getAttribute("data-shape-id");
            const shape = id ? (shapes.get(id)?.toJSON() as Shape) : null;
            if (shape?.kind === "pin") {
              if (shape.link) void data.open(shape.link);
              else if (!readOnly)
                setPin({
                  x: shape.x,
                  y: shape.y,
                  id: shape.id,
                  label: shape.text ?? "Pin",
                  link: "",
                });
              return;
            }
            if (readOnly) return;
            if (shape)
              setText({
                x: shape.x,
                y: shape.y,
                value: shape.text ?? "",
                id: shape.id,
              });
          }}
          onKeyDown={(e) => {
            if (readOnly) return;
            const keys: Record<string, Tool> = {
              v: "select",
              h: "hand",
              r: "rect",
              o: "ellipse",
              a: "arrow",
              p: "pen",
              t: "text",
              i: "pin",
            };
            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
              e.preventDefault();
              e.shiftKey ? undo.current?.redo() : undo.current?.undo();
            } else if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault();
              erase();
            } else if (e.key === "Escape") setSelected(null);
            else if (keys[e.key.toLowerCase()])
              setTool(keys[e.key.toLowerCase()]);
          }}
        >
          <defs>
            <pattern
              id={`grid-${scope}`}
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="#dbd8d1" />
            </pattern>
          </defs>
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill={`url(#grid-${scope})`}
          />
          {shapeValues(shapes).map((shape) => (
            <ShapeView
              key={shape.id}
              shape={shape}
              selected={shape.id === selected && !readOnly}
              linkedLabel={
                shape.link
                  ? (() => {
                      const target = data.resolve(shape.link!);
                      return target
                        ? referenceText(target)
                        : "Missing reference";
                    })()
                  : undefined
              }
              linkedTitle={
                shape.link
                  ? (() => {
                      const target = data.resolve(shape.link!);
                      return target ? referenceTitle(target) : shape.link;
                    })()
                  : undefined
              }
            />
          ))}
          {draft && <ShapeView shape={draft} selected={false} />}{" "}
          {cursors.map(([id, state]) => (
            <g
              key={id}
              className="canvas-cursor"
              transform={`translate(${state.canvas.x},${state.canvas.y})`}
            >
              <path
                d="M0 0 L4 18 L9 12 L17 11 Z"
                fill={state.user?.color ?? "#4f83cf"}
              />
              <text
                x="16"
                y="28"
                fontSize="14"
                fill={state.user?.color ?? "#4f83cf"}
              >
                {state.user?.name ?? "Someone"}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {text && (
        <Modal
          title={text.id ? "Edit label" : "Add label"}
          onClose={() => setText(null)}
        >
          <textarea
            autoFocus
            aria-label="Canvas text"
            value={text.value}
            onChange={(event) => {
              setText({ ...text, value: event.target.value });
              const match = /(?:^|\s)(\/\w*)$/.exec(event.target.value);
              const bounds = event.currentTarget.getBoundingClientRect();
              setSlash(
                match
                  ? {
                      query: match[1],
                      from: event.target.value.length - match[1].length,
                      to: event.target.value.length,
                      x: bounds.left,
                      y: bounds.bottom,
                    }
                  : null,
              );
            }}
            className="field"
            rows={4}
          />
          {slash && (
            <SlashPopover
              state={slash}
              onClose={() => setSlash(null)}
              onLink={(urn) => {
                putShape(shapes, {
                  id: crypto.randomUUID(),
                  kind: "pin",
                  x: text.x,
                  y: text.y,
                  width: 40,
                  height: 56,
                  color,
                  fill: "none",
                  text: text.value.slice(0, slash.from).trim() || "Pin",
                  link: urn,
                });
                setText(null);
                setSlash(null);
                setTool("select");
              }}
            />
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={!text.value.trim()}
              onClick={() => {
                if (text.id) updateShape(shapes, text.id, { text: text.value });
                else
                  putShape(shapes, {
                    id: crypto.randomUUID(),
                    kind: "text",
                    x: text.x,
                    y: text.y,
                    width: Math.max(100, text.value.length * 14),
                    height: 40,
                    color,
                    fill: "none",
                    text: text.value,
                  });
                setText(null);
                setTool("select");
              }}
            >
              Save text
            </button>
          </div>
        </Modal>
      )}
      {pin && (
        <Modal
          title={pin.id ? "Edit canvas pin" : "Add canvas pin"}
          onClose={() => {
            setPin(null);
            setPinPicker(false);
          }}
        >
          <label className="field-label">
            Pin name
            <input
              autoFocus
              className="field"
              aria-label="Pin name"
              placeholder="Pin name"
              value={pin.label}
              onChange={(event) => {
                setPin({ ...pin, label: event.target.value });
                if (/\/link$/.test(event.target.value)) setPinPicker(true);
              }}
            />
          </label>
          {pin.link && (
            <ReferenceChip
              urn={pin.link}
              onRemove={() => setPin({ ...pin, link: "" })}
            />
          )}
          <button
            className="secondary-button"
            aria-label="Choose pin target"
            onClick={() => setPinPicker(!pinPicker)}
          >
            <Link2 size={14} />
            Choose a link target
          </button>
          {pinPicker && (
            <ReferencePicker
              onSelect={(link) => {
                setPin({
                  ...pin,
                  link,
                  label: pin.label.replace(/\/link$/, "").trim() || "Pin",
                });
                setPinPicker(false);
              }}
              onClose={() => setPinPicker(false)}
            />
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              onClick={() => {
                if (pin.id)
                  updateShape(shapes, pin.id, {
                    text: pin.label || "Pin",
                    link: pin.link,
                  });
                else
                  putShape(shapes, {
                    id: crypto.randomUUID(),
                    kind: "pin",
                    x: pin.x,
                    y: pin.y,
                    width: 40,
                    height: 56,
                    color,
                    fill: "none",
                    text: pin.label || "Pin",
                    link: pin.link,
                  });
                setPin(null);
                setPinPicker(false);
                setTool("select");
              }}
            >
              Save pin
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
