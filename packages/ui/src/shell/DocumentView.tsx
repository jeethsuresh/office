import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Layout,
  PenTool,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  blocks as getBlocks,
  addBlock,
  removeBlock,
  makeUndoManager,
  shapeValues,
  BLOCK_META,
  type BlockKind,
  type SharedRecord,
} from "@office/model";
import type { DocumentSession } from "@office/collaboration";
import { useShared, useSession } from "../shared/hooks";
import { Modal } from "../shared/Modal";
import { DocEditor } from "../blocks/DocEditor";
import { CanvasEditor } from "../blocks/CanvasEditor";
import { SlidesEditor } from "../blocks/SlidesEditor";
import { Minimap } from "./Minimap";
import { EditorFullscreenProvider } from "../shared/Fullscreen";
const icons = { doc: FileText, canvas: PenTool, slides: Layout };
function Peek({
  block,
  direction,
  onClick,
  onAdd,
}: {
  block?: SharedRecord;
  direction: "previous" | "next";
  onClick: () => void;
  onAdd: () => void;
}) {
  if (!block)
    return (
      <button
        className="block-boundary-add"
        onClick={onAdd}
        aria-label={
          direction === "previous"
            ? "Add block at beginning"
            : "Add block at end"
        }
      >
        <Plus size={15} />
        <span>
          {direction === "previous"
            ? "A new beginning"
            : "Room for another idea"}
        </span>
      </button>
    );
  const kind = block.get("kind") as BlockKind;
  const Icon = icons[kind] ?? FileText;
  const excerpt =
    kind === "doc"
      ? (block.get("content") as Y.XmlFragment)
          .toString()
          .replace(/<[^>]+>/g, " ")
          .trim()
          .slice(0, 90)
      : kind === "slides"
        ? (block.get("slides") as Y.Array<SharedRecord>)
            .toArray()
            .map((slide) => slide.get("title").toString())
            .join(" / ")
        : `${(block.get("shapes") as Y.Map<SharedRecord>).size} objects on an open canvas`;
  const shapes = kind === "canvas" ? shapeValues(block.get("shapes")) : [];
  return (
    <button
      className={`block-peek ${direction}`}
      onClick={onClick}
      style={
        { "--block-color": BLOCK_META[kind]?.color } as React.CSSProperties
      }
    >
      <Icon size={14} />
      <span className="peek-title">{block.get("title")}</span>
      {kind === "canvas" && shapes.length > 0 && (
        <svg className="peek-sketch" aria-hidden="true" viewBox="0 0 1200 650">
          {shapes
            .slice(0, 8)
            .map((shape) =>
              shape.kind === "rect" ? (
                <rect
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={Math.abs(shape.width)}
                  height={Math.abs(shape.height)}
                  rx="12"
                  fill={shape.fill}
                  stroke={shape.color}
                  strokeWidth="12"
                />
              ) : shape.kind === "ellipse" ? (
                <ellipse
                  key={shape.id}
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + shape.height / 2}
                  rx={Math.abs(shape.width / 2)}
                  ry={Math.abs(shape.height / 2)}
                  fill={shape.fill}
                  stroke={shape.color}
                  strokeWidth="12"
                />
              ) : shape.kind === "arrow" ? (
                <path
                  key={shape.id}
                  d={`M${shape.x} ${shape.y} l${shape.width} ${shape.height}`}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth="12"
                />
              ) : null,
            )}
        </svg>
      )}
      <span className="peek-excerpt">{excerpt}</span>
      {direction === "previous" ? (
        <ArrowUp size={14} />
      ) : (
        <ArrowDown size={14} />
      )}
    </button>
  );
}
export function DocumentView({ session }: { session: DocumentSession }) {
  const shared = useShared(getBlocks(session.doc));
  const list = shared.toArray();
  const blockIDs = list.map((block) => block.get("id")).join(",");
  const state = useSession(session);
  const [active, setActive] = useState("");
  const [activeSlides, setActiveSlides] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<{
    block: string;
    slide: string;
    token: number;
  } | null>(null);
  const [insert, setInsert] = useState<number | null>(null);
  const undo = useRef<Y.UndoManager | null>(null);
  const [deleteID, setDeleteID] = useState<string | null>(null);
  useEffect(() => {
    undo.current = makeUndoManager(shared);
    return () => undo.current?.destroy();
  }, [shared]);
  function navigate(id: string, slide?: string) {
    setActive(id);
    session.setActiveBlock(id);
    if (slide) {
      setActiveSlides((previous) =>
        previous[id] === slide ? previous : { ...previous, [id]: slide },
      );
      setRequest({ block: id, slide, token: performance.now() });
    }
  }
  useEffect(() => {
    if (!list.some((b) => b.get("id") === active) && list.length) {
      setActive(list[0].get("id"));
      session.setActiveBlock(list[0].get("id"));
    }
  }, [blockIDs, active]);
  if (!state.hydrated)
    return (
      <div className="loading-document">
        <div className="loading-mark" />
        <p>Making a little space…</p>
      </div>
    );
  return (
    <EditorFullscreenProvider
      navigation={{ blocks: list, active, activeSlides, onNavigate: navigate }}
    >
      <div className="document-view">
        <div className="block-viewport">
          {!list.length && (
            <div className="empty-document">
              <div className="empty-art">
                <FileText />
                <PenTool />
                <Layout />
              </div>
              <span className="eyebrow">
                A BLANK PAGE. A WORLD OF POSSIBILITY.
              </span>
              <h1>
                Where will your
                <br />
                thinking take you?
              </h1>
              <p>
                A note to start. A canvas to explore.
                <br />A story to bring it all together.
              </p>
              <button className="primary-button" onClick={() => setInsert(0)}>
                <Plus size={18} />
                Add your first block
              </button>
            </div>
          )}
          {list.map((block, index) => {
            const id = block.get("id");
            const kind = block.get("kind") as BlockKind;
            const Icon = icons[kind] ?? FileText;
            return (
              <section
                key={id}
                data-block-id={id}
                hidden={active !== id}
                inert={active !== id}
                className={`office-block block-${kind} ${active === id ? "is-active" : ""}`}
                style={
                  {
                    "--block-color": BLOCK_META[kind]?.color,
                  } as React.CSSProperties
                }
              >
                <Peek
                  block={list[index - 1]}
                  direction="previous"
                  onClick={() => navigate(list[index - 1].get("id"))}
                  onAdd={() => setInsert(0)}
                />
                <div className="block-heading">
                  <span className="block-type">
                    <Icon size={15} />
                    {BLOCK_META[kind]?.name}
                  </span>
                  <span className="block-sequence">
                    {String(index + 1).padStart(2, "0")} <i>/</i>{" "}
                    {String(list.length).padStart(2, "0")}
                  </span>
                  <input
                    className="block-title"
                    aria-label={`${BLOCK_META[kind]?.name} block title`}
                    value={block.get("title") ?? ""}
                    onChange={(e) => block.set("title", e.target.value)}
                  />
                  <button
                    className="icon-button insert-block"
                    aria-label={`Insert block after ${index + 1}`}
                    title="Insert a block here"
                    onClick={() => setInsert(index + 1)}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete block ${index + 1}`}
                    title="Delete this block"
                    onClick={() => setDeleteID(id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="block-body">
                  {kind === "doc" ? (
                    <DocEditor
                      fragment={block.get("content")}
                      session={session}
                    />
                  ) : kind === "canvas" ? (
                    <CanvasEditor
                      shapes={block.get("shapes")}
                      scope={id}
                      session={session}
                    />
                  ) : kind === "slides" ? (
                    <SlidesEditor
                      block={block}
                      session={session}
                      onActiveSlide={(slide) =>
                        setActiveSlides((prev) =>
                          prev[id] === slide ? prev : { ...prev, [id]: slide },
                        )
                      }
                      requestedSlide={
                        request && request.block === id
                          ? request.slide
                          : undefined
                      }
                      requestToken={request?.token}
                    />
                  ) : (
                    <p>This block type is not registered.</p>
                  )}
                </div>
                <Peek
                  block={list[index + 1]}
                  direction="next"
                  onClick={() => navigate(list[index + 1].get("id"))}
                  onAdd={() => setInsert(list.length)}
                />
              </section>
            );
          })}
          {list.length > 0 && (
            <div className="document-end">
              <span>A little more room to think.</span>
              <button
                className="text-button"
                onClick={() => {
                  undo.current?.undo();
                }}
              >
                <Undo2 size={14} />
                Undo block change
              </button>
            </div>
          )}
        </div>
        <Minimap
          blocks={list}
          active={active}
          activeSlides={activeSlides}
          onNavigate={navigate}
          onAdd={() => setInsert(list.length)}
        />
        {insert !== null && (
          <Modal
            title="What comes next?"
            onClose={() => setInsert(null)}
            className="add-block-modal"
          >
            <p className="muted">
              Three ways to think. One connected document.
            </p>
            <div className="block-choices">
              {(Object.keys(BLOCK_META) as BlockKind[]).map((kind) => {
                const meta = BLOCK_META[kind];
                const Icon = icons[kind];
                return (
                  <button
                    key={kind}
                    className="block-choice"
                    style={
                      { "--block-color": meta.color } as React.CSSProperties
                    }
                    onClick={() => {
                      undo.current?.stopCapturing();
                      const block = addBlock(session.doc, kind, insert);
                      setInsert(null);
                      setTimeout(() => navigate(block.get("id")), 50);
                    }}
                  >
                    <span className="choice-icon">
                      <Icon size={24} />
                    </span>
                    <strong>{meta.name}</strong>
                    <span>{meta.description}</span>
                    <Plus size={17} />
                  </button>
                );
              })}
            </div>
            <p className="modal-footnote">
              Add them in any order. Make it your own.
            </p>
          </Modal>
        )}
        {deleteID && (
          <Modal title="Delete this block?" onClose={() => setDeleteID(null)}>
            <p className="muted">
              This removes the block and its content from the document. You can
              undo the change below the last block.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setDeleteID(null)}
              >
                Keep it
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  undo.current?.stopCapturing();
                  removeBlock(session.doc, deleteID);
                  setDeleteID(null);
                }}
              >
                Delete block
              </button>
            </div>
          </Modal>
        )}
      </div>
    </EditorFullscreenProvider>
  );
}
