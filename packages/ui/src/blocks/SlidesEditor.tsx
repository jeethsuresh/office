import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  Plus,
  Type,
  Layout,
  Play,
  Trash2,
  ArrowLeft,
  ArrowRight,
  X,
  Undo2,
  Redo2,
} from "lucide-react";
import {
  addSlide,
  LOCAL_ORIGIN,
  makeUndoManager,
  type SharedRecord,
} from "@office/model";
import type { DocumentSession } from "@office/collaboration";
import { useShared } from "../shared/hooks";
import { ToolButton } from "../shared/Toolbar";
import { slideLayouts } from "./slideLayouts";
export function SlidesEditor({
  block,
  session,
  onActiveSlide,
  requestedSlide,
  requestToken,
}: {
  block: SharedRecord;
  session: DocumentSession;
  onActiveSlide: (id: string) => void;
  requestedSlide?: string;
  requestToken?: number;
}) {
  const slides = block.get("slides") as Y.Array<SharedRecord>;
  useShared(slides);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [present, setPresent] = useState(false);
  const undo = useRef<Y.UndoManager | null>(null);
  const list = slides.toArray();
  useEffect(() => {
    undo.current = makeUndoManager(slides);
    return () => undo.current?.destroy();
  }, [slides]);
  function go(index: number) {
    index = Math.max(0, Math.min(index, list.length - 1));
    setActive(index);
    const slide = list[index];
    if (slide) {
      onActiveSlide(slide.get("id"));
      track.current
        ?.querySelector<HTMLElement>(`[data-slide-id="${slide.get("id")}"]`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
    }
  }
  useEffect(() => {
    if (requestedSlide) {
      const index = slides
        .toArray()
        .findIndex((s) => s.get("id") === requestedSlide);
      if (index >= 0) go(index);
    }
  }, [requestedSlide, requestToken]);
  useEffect(() => {
    if (active >= list.length) setActive(Math.max(0, list.length - 1));
    if (list[active]) onActiveSlide(list[active].get("id"));
  }, [list.length, active]);
  useEffect(() => {
    if (!present) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresent(false);
      if (e.key === "ArrowRight") go(active + 1);
      if (e.key === "ArrowLeft") go(active - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [present, active, list.length]);
  function add(layout: string) {
    undo.current?.stopCapturing();
    const slide = addSlide(block, layout);
    setTimeout(() => {
      const i = slides.toArray().indexOf(slide);
      go(i);
    }, 30);
  }
  const slide = list[Math.min(active, list.length - 1)];
  const Presentation = slide
    ? (slideLayouts[slide.get("layout")] ?? slideLayouts.content).component
    : null;
  return (
    <div className="slides-editor">
      <div className="editor-tools slide-tools" aria-label="Slide tools">
        <span className="rail-label">ADD</span>
        {Object.entries(slideLayouts).map(([id, layout]) => (
          <ToolButton
            key={id}
            label={`Add ${layout.label.toLowerCase()}`}
            onClick={() => add(id)}
          >
            {id === "title" ? <Type size={18} /> : <Layout size={18} />}
          </ToolButton>
        ))}
        <span className="tool-divider" />
        <ToolButton
          label="Present slides"
          disabled={!list.length}
          onClick={() => setPresent(true)}
        >
          <Play size={17} />
        </ToolButton>
        <ToolButton
          label="Delete slide"
          disabled={!slide}
          onClick={() => {
            if (slide)
              session.doc.transact(
                () => slides.delete(Math.min(active, slides.length - 1), 1),
                LOCAL_ORIGIN,
              );
          }}
        >
          <Trash2 size={16} />
        </ToolButton>
        <ToolButton label="Undo slides" onClick={() => undo.current?.undo()}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Redo slides" onClick={() => undo.current?.redo()}>
          <Redo2 size={16} />
        </ToolButton>
      </div>
      <div className="slides-workspace">
        <div
          className="slide-track"
          ref={track}
          onScroll={() => {
            const el = track.current;
            if (!el) return;
            const cards = Array.from(
              el.querySelectorAll<HTMLElement>("[data-slide-id]"),
            );
            const left = el.getBoundingClientRect().left;
            let best = 0,
              dist = Infinity;
            cards.forEach((card, i) => {
              const d = Math.abs(card.getBoundingClientRect().left - left - 20);
              if (d < dist) {
                dist = d;
                best = i;
              }
            });
            if (best !== active) {
              setActive(best);
              if (list[best]) onActiveSlide(list[best].get("id"));
            }
          }}
        >
          {list.map((s, index) => {
            const layout =
              slideLayouts[s.get("layout")] ?? slideLayouts.content;
            const Component = layout.component;
            return (
              <div
                className={`slide-card ${index === active ? "current" : ""}`}
                data-slide-id={s.get("id")}
                key={s.get("id")}
              >
                <div className="slide-topline">
                  <span>
                    {String(index + 1).padStart(2, "0")} / {layout.label}
                  </span>
                  <select
                    aria-label={`Layout of slide ${index + 1}`}
                    value={s.get("layout")}
                    onChange={(e) => s.set("layout", e.target.value)}
                  >
                    {Object.entries(slideLayouts).map(([id, l]) => (
                      <option key={id} value={id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Component slide={s} session={session} />
              </div>
            );
          })}
          {!list.length && (
            <div className="empty-slides">
              <Layout size={32} />
              <p>Your next story starts here.</p>
              <button className="secondary-button" onClick={() => add("title")}>
                <Plus size={16} />
                Add a title slide
              </button>
            </div>
          )}
        </div>
        <div className="slide-navigation">
          <span>
            {list.length
              ? `${String(active + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`
              : "No slides yet"}
          </span>
          <div className="slide-dots">
            {list.map((s, i) => (
              <button
                aria-label={`Go to slide ${i + 1}`}
                className={active === i ? "active" : ""}
                key={s.get("id")}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="Previous slide"
            disabled={active === 0}
            onClick={() => go(active - 1)}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Next slide"
            disabled={active >= list.length - 1}
            onClick={() => go(active + 1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      {present && slide && Presentation && (
        <div
          className="presentation"
          role="dialog"
          aria-modal="true"
          aria-label="Presentation"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <button
            className="presentation-close icon-button"
            autoFocus
            aria-label="Exit presentation"
            onClick={() => setPresent(false)}
          >
            <X />
          </button>
          <div className="presented-slide">
            <Presentation slide={slide} session={session} readOnly />
          </div>
          <div className="presentation-navigation">
            <button
              className="icon-button"
              aria-label="Previous presented slide"
              disabled={active === 0}
              onClick={() => go(active - 1)}
            >
              <ArrowLeft />
            </button>
            <span>
              {active + 1} / {list.length}
            </span>
            <button
              className="icon-button"
              aria-label="Next presented slide"
              disabled={active === list.length - 1}
              onClick={() => go(active + 1)}
            >
              <ArrowRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
