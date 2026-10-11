import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  Maximize2,
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
import { EditorTools, useEditorFullscreen } from "../shared/Fullscreen";
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
  const fullscreen = useEditorFullscreen(`block:${block.get("id")}`);
  const slides = block.get("slides") as Y.Array<SharedRecord>;
  useShared(slides);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeIndex = useRef(active);
  activeIndex.current = active;
  const reportActive = useRef(onActiveSlide);
  reportActive.current = onActiveSlide;
  const [present, setPresent] = useState(false);
  const undo = useRef<Y.UndoManager | null>(null);
  const list = slides.toArray();
  useEffect(() => {
    undo.current = makeUndoManager(slides);
    return () => undo.current?.destroy();
  }, [slides]);
  function go(index: number) {
    const current = slides.toArray();
    index = Math.max(0, Math.min(index, current.length - 1));
    setActive(index);
    activeIndex.current = index;
    position(index);
    const slide = current[index];
    if (slide) {
      onActiveSlide(slide.get("id"));
    }
  }
  function position(index: number) {
    const element = track.current;
    const card = element?.querySelectorAll<HTMLElement>(".slide-card")[index];
    if (element && card && !card.classList.contains("editor-fullscreen"))
      element.scrollTo({
        left:
          card.offsetLeft - parseFloat(getComputedStyle(element).paddingLeft),
        behavior: "instant",
      });
  }
  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    const align = () => position(activeIndex.current);
    align();
    const resize = new ResizeObserver(align);
    resize.observe(element);
    return () => resize.disconnect();
  }, [list.map((s) => s.get("id")).join(","), fullscreen.active]);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let timer: ReturnType<typeof setTimeout>;
    const settle = () => {
      clearTimeout(timer);
      const padding = parseFloat(getComputedStyle(element).paddingLeft);
      const cards = [...element.querySelectorAll<HTMLElement>(".slide-card")];
      if (
        !cards.length ||
        cards.some((card) => card.classList.contains("editor-fullscreen"))
      )
        return;
      let nearest = 0;
      cards.forEach((card, index) => {
        if (
          Math.abs(card.offsetLeft - padding - element.scrollLeft) <
          Math.abs(cards[nearest].offsetLeft - padding - element.scrollLeft)
        )
          nearest = index;
      });
      activeIndex.current = nearest;
      setActive(nearest);
      const selected = slides.get(nearest);
      if (selected) reportActive.current(selected.get("id"));
    };
    // scrollend follows native snap animation; debounce supports older engines.
    const scrolling = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 180);
    };
    element.addEventListener("scroll", scrolling);
    element.addEventListener("scrollend", settle);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("scroll", scrolling);
      element.removeEventListener("scrollend", settle);
    };
  }, [slides]);
  useLayoutEffect(() => {
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
    <div
      ref={fullscreen.ref}
      className={`slides-editor ${fullscreen.className}`}
    >
      <EditorTools
        className="slide-tools"
        label="Slide tools"
        fullscreen={fullscreen}
        fullscreenLabel="Fullscreen slides"
      >
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
          label="Previous slide"
          disabled={active === 0}
          onClick={() => go(active - 1)}
        >
          <ArrowLeft size={17} />
        </ToolButton>
        <ToolButton
          label="Next slide"
          disabled={active >= list.length - 1}
          onClick={() => go(active + 1)}
        >
          <ArrowRight size={17} />
        </ToolButton>
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
      </EditorTools>
      <div className="slides-workspace">
        <div className="slide-track" ref={track}>
          {list.map((s, index) => (
            <SlideCard
              key={s.get("id")}
              slide={s}
              session={session}
              index={index}
              current={index === active}
            />
          ))}
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
          <div className="slide-dots" aria-hidden="true">
            {list.map((s, i) => (
              <span
                className={active === i ? "active" : ""}
                key={s.get("id")}
              />
            ))}
          </div>
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

function SlideCard({
  slide,
  session,
  index,
  current,
}: {
  slide: SharedRecord;
  session: DocumentSession;
  index: number;
  current: boolean;
}) {
  useShared(slide);
  const fullscreen = useEditorFullscreen(`slide:${slide.get("id")}`);
  const layout = slideLayouts[slide.get("layout")] ?? slideLayouts.content;
  const Component = layout.component;
  const picker = (
    <select
      aria-label={`Layout of slide ${index + 1}`}
      value={slide.get("layout")}
      onChange={(e) => slide.set("layout", e.target.value)}
    >
      {Object.entries(slideLayouts).map(([id, l]) => (
        <option key={id} value={id}>
          {l.label}
        </option>
      ))}
    </select>
  );
  return (
    <div
      ref={fullscreen.ref}
      className={`slide-card ${current ? "current" : ""} ${fullscreen.className}`}
      data-slide-id={slide.get("id")}
      inert={!current}
    >
      {fullscreen.active && (
        <div className="fullscreen-only slide-focus-tools">
          <EditorTools
            className="slide-tools"
            label="Focused slide tools"
            fullscreen={fullscreen}
            fullscreenLabel={`Fullscreen slide ${index + 1}`}
          >
            <label className="slide-layout-tool">Layout{picker}</label>
          </EditorTools>
        </div>
      )}
      <div className="slide-topline">
        <span>
          {String(index + 1).padStart(2, "0")} / {layout.label}
        </span>
        <div className="slide-topline-actions">
          {!fullscreen.active && picker}
          <button
            className="icon-button fullscreen-enter"
            aria-label={`Fullscreen slide ${index + 1}`}
            title="Fullscreen slide"
            onClick={fullscreen.enter}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <Component slide={slide} session={session} />
    </div>
  );
}
