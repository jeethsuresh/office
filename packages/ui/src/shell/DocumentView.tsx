import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Layout,
  PenTool,
  Plus,
  Table2,
} from "lucide-react";
import {
  blocks as getBlocks,
  blockMoves,
  orderedBlocks,
  moveBlock,
  addBlock,
  removeBlock,
  makeUndoManager,
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
import { SheetEditor } from "../blocks/SheetEditor";
import { CopyReference, Backlinks } from "../shared/References";
import { ReferenceNavigation } from "../shared/ReferenceNavigation";
import { BlockActionsProvider, BlockActionsSlot } from "../shared/BlockActions";
import { BlockUpdated } from "./BlockUpdated";
import { useBlockMotion } from "./useBlockMotion";
const icons = { doc: FileText, canvas: PenTool, slides: Layout, sheet: Table2 };
function BlockEdgePill({
  block,
  direction,
  onClick,
}: {
  block?: SharedRecord;
  direction: "previous" | "next";
  onClick: () => void;
}) {
  if (!block)
    return (
      <button
        className={`block-boundary-add block-navigation-pill ${direction}`}
        onClick={onClick}
        title={
          direction === "previous"
            ? "Add block at beginning"
            : "Add block at end"
        }
        style={{ "--block-color": "#92968b" } as React.CSSProperties}
        aria-label={
          direction === "previous"
            ? "Add block at beginning"
            : "Add block at end"
        }
      >
        <Plus size={15} />
        <span>Add block</span>
      </button>
    );
  const kind = block.get("kind") as BlockKind;
  const Icon = icons[kind] ?? FileText;
  const title = block.get("title") || "Untitled block";
  return (
    <button
      className={`block-peek block-navigation-pill ${direction}`}
      onClick={onClick}
      title={title}
      aria-label={`Go to ${direction} block: ${title}`}
      style={
        { "--block-color": BLOCK_META[kind]?.color } as React.CSSProperties
      }
    >
      <Icon size={14} />
      <span className="peek-title">{title}</span>
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
  const moves = useShared(blockMoves(session.doc));
  const list = orderedBlocks(session.doc);
  const blockIDs = list.map((block) => block.get("id")).join(",");
  const state = useSession(session);
  const [active, setActive] = useState("");
  const motion = useBlockMotion(active, blockIDs, state.hydrated);
  const activeIndex = Math.max(
    0,
    list.findIndex((block) => block.get("id") === active),
  );
  const positionIndex = list.findIndex(
    (block) => block.get("id") === motion.position,
  );
  const [activeSlides, setActiveSlides] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<{
    block: string;
    slide: string;
    token: number;
  } | null>(null);
  const [insert, setInsert] = useState<
    "start" | "end" | "before" | "after" | null
  >(null);
  const [insertAnchor, setInsertAnchor] = useState("");
  const undo = useRef<Y.UndoManager | null>(null);
  const [deleteID, setDeleteID] = useState<string | null>(null);
  function openInsert(position: NonNullable<typeof insert>) {
    setInsertAnchor(active);
    setInsert(position);
  }
  function insertAtGap(before: string | null) {
    setInsertAnchor(before ?? active);
    setInsert(before ? "before" : "end");
  }
  function reorder(id: string, before: string | null) {
    undo.current?.stopCapturing();
    moveBlock(session.doc, id, before);
    undo.current?.stopCapturing();
  }
  useEffect(() => {
    undo.current = makeUndoManager([shared, moves]);
    return () => undo.current?.destroy();
  }, [shared, moves]);
  function navigate(id: string, slide?: string) {
    motion.prepare(id);
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
      setActive((previous) =>
        list.some((block) => block.get("id") === previous)
          ? previous
          : list[0].get("id"),
      );
      session.setActiveBlock(list[0].get("id"));
    }
  }, [blockIDs, active]);
  if (!state.hydrated)
    return (
      <div className="loading-document">
        <div className="loading-mark" />
        <p>Loading document…</p>
      </div>
    );
  return (
    <EditorFullscreenProvider
      navigation={{
        blocks: list,
        active,
        activeSlides,
        onNavigate: navigate,
        onMove: reorder,
        onAddAt: insertAtGap,
        onDeleteBlock: setDeleteID,
      }}
    >
      <ReferenceNavigation />
      <div
        id="portal"
        data-office-portal
        style={{ position: "fixed", left: 0, top: 0, zIndex: 21000 }}
      />
      <div className="document-view">
        <div
          ref={motion.viewport}
          className={`block-viewport ${motion.moving ? "is-navigating" : ""}`}
        >
          {!list.length && (
            <div className="empty-document">
              <div className="empty-art">
                <FileText />
                <PenTool />
                <Layout />
              </div>
              <h1>Empty document</h1>
              <button
                className="primary-button"
                onClick={() => openInsert("start")}
              >
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
              <BlockActionsProvider key={id} onDelete={() => setDeleteID(id)}>
                <section
                  key={id}
                  data-block-id={id}
                  className={`office-block block-${kind} ${active === id ? "is-active" : ""} ${Math.abs(index - activeIndex) === 1 ? "is-neighbor" : ""}`}
                  style={
                    {
                      "--block-color": BLOCK_META[kind]?.color,
                      "--block-offset":
                        index -
                        (positionIndex < 0 ? activeIndex : positionIndex),
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="block-heading"
                    hidden={active !== id}
                    inert={active !== id}
                  >
                    <span
                      className="block-type"
                      title={BLOCK_META[kind]?.name}
                      aria-label={`${BLOCK_META[kind]?.name} block`}
                    >
                      <Icon size={15} />
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
                    <div className="block-heading-actions">
                      <CopyReference
                        urn={`${session.id}:${id}:_`}
                        label="Copy block reference"
                      />
                      <BlockActionsSlot />
                      <BlockUpdated block={block} />
                      <Backlinks urn={`${session.id}:${id}:_`} />
                    </div>
                  </div>
                  <div className="block-editor">
                    <div
                      className="block-body"
                      inert={active !== id}
                      aria-hidden={active !== id}
                    >
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
                              prev[id] === slide
                                ? prev
                                : { ...prev, [id]: slide },
                            )
                          }
                          requestedSlide={
                            request && request.block === id
                              ? request.slide
                              : undefined
                          }
                          requestToken={request?.token}
                        />
                      ) : kind === "sheet" ? (
                        <SheetEditor block={block} session={session} />
                      ) : (
                        <p>This block type is not registered.</p>
                      )}
                    </div>
                    {Math.abs(index - activeIndex) === 1 && (
                      <BlockEdgePill
                        block={block}
                        direction={index < activeIndex ? "previous" : "next"}
                        onClick={() => navigate(id)}
                      />
                    )}
                  </div>
                </section>
              </BlockActionsProvider>
            );
          })}
          {list.length > 0 && activeIndex === 0 && (
            <div className="block-boundary previous">
              <BlockEdgePill
                direction="previous"
                onClick={() => openInsert("start")}
              />
            </div>
          )}
          {list.length > 0 && activeIndex === list.length - 1 && (
            <div className="block-boundary next">
              <BlockEdgePill
                direction="next"
                onClick={() => openInsert("end")}
              />
            </div>
          )}
        </div>
        <Minimap
          blocks={list}
          active={active}
          activeSlides={activeSlides}
          onNavigate={navigate}
          onMove={reorder}
          onAddAt={insertAtGap}
          onDeleteBlock={setDeleteID}
          onAdd={() => openInsert("after")}
          onDelete={() => setDeleteID(active)}
          onUndo={() => undo.current?.undo()}
        />
        {insert !== null && (
          <Modal
            title="Add block"
            onClose={() => setInsert(null)}
            className="add-block-modal"
          >
            {list.length > 0 && (
              <label className="field-label">
                Block position
                <select
                  className="field"
                  aria-label="Block position"
                  value={insert}
                  onChange={(event) =>
                    setInsert(event.target.value as NonNullable<typeof insert>)
                  }
                >
                  <option value="start">Beginning of document</option>
                  {insertAnchor && (
                    <>
                      <option value="before">
                        Before{" "}
                        {list
                          .find((block) => block.get("id") === insertAnchor)
                          ?.get("title") || "selected block"}
                      </option>
                      <option value="after">
                        After{" "}
                        {list
                          .find((block) => block.get("id") === insertAnchor)
                          ?.get("title") || "selected block"}
                      </option>
                    </>
                  )}
                  <option value="end">End of document</option>
                </select>
              </label>
            )}
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
                      const current = orderedBlocks(session.doc);
                      const anchor = current.findIndex(
                        (block) => block.get("id") === insertAnchor,
                      );
                      const index =
                        insert === "start"
                          ? 0
                          : insert === "end" || anchor < 0
                            ? current.length
                            : anchor + (insert === "after" ? 1 : 0);
                      const block = addBlock(session.doc, kind, index);
                      setInsert(null);
                      navigate(block.get("id"));
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
          </Modal>
        )}
        {deleteID && (
          <Modal title="Delete this block?" onClose={() => setDeleteID(null)}>
            <p className="muted">
              This removes{" "}
              <strong>
                {list
                  .find((block) => block.get("id") === deleteID)
                  ?.get("title") || "this block"}
              </strong>{" "}
              and its content from the document. You can undo the change from
              the minimap.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setDeleteID(null)}
              >
                Cancel
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
