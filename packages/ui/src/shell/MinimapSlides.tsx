import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SharedRecord } from "@office/model";
import { SlidePreview } from "./BlockPreview";

export function MinimapSlides({
  slides,
  title,
  selected,
  active,
  onNavigate,
  hint,
  onScroll,
  contextMenuOpen = false,
}: {
  slides: SharedRecord[];
  title: string;
  selected?: string;
  active: boolean;
  onNavigate: (slide: string) => void;
  hint: (key: string, text: string) => ButtonHTMLAttributes<HTMLButtonElement>;
  onScroll: () => void;
  contextMenuOpen?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const rowHeight = useRef(20);
  const animation = useRef(0);
  const [browsing, setBrowsing] = useState(false);
  const windowed = slides.length > 5;
  const selectedIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.get("id") === selected),
  );
  const ids = slides.map((slide) => slide.get("id")).join(",");
  function stop() {
    cancelAnimationFrame(animation.current);
    animation.current = 0;
  }
  function center() {
    viewport.current?.scrollTo({
      top: windowed ? selectedIndex * rowHeight.current : 0,
      behavior: "instant",
    });
  }
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const size = () => {
      // Padding adds two empty slots at each end, keeping even the first/last
      // slide in the center without borrowing rows from another block.
      rowHeight.current = Math.max(
        1,
        element.clientHeight / Math.min(5, slides.length),
      );
      element.style.setProperty(
        "--slide-marker-height",
        `${rowHeight.current}px`,
      );
      center();
    };
    size();
    const observer = new ResizeObserver(size);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ids, selectedIndex, windowed]);
  useEffect(() => () => stop(), []);
  function hoverScroll(
    event: PointerEvent<HTMLButtonElement>,
    direction: number,
  ) {
    if (event.pointerType !== "mouse") return;
    stop();
    let previous = performance.now();
    let position = viewport.current?.scrollTop ?? 0;
    const step = (now: number) => {
      const element = viewport.current;
      if (!element) return;
      position +=
        (direction * rowHeight.current * Math.min(now - previous, 50)) / 350;
      const end = element.scrollHeight - element.clientHeight;
      position = Math.max(0, Math.min(position, end));
      element.scrollTop = position;
      previous = now;
      if ((direction < 0 && position > 0) || (direction > 0 && position < end))
        animation.current = requestAnimationFrame(step);
      else animation.current = 0;
    };
    animation.current = requestAnimationFrame(step);
  }
  const scrollButton = (direction: number) => (
    <button
      className="minimap-slide-scroll"
      aria-label={`${direction < 0 ? "Earlier" : "Later"} slides in ${title}`}
      onPointerEnter={(event) => hoverScroll(event, direction)}
      onPointerLeave={stop}
      onBlur={stop}
      onClick={() => {
        stop();
        viewport.current?.scrollBy({
          top: direction * rowHeight.current,
          behavior: "smooth",
        });
      }}
    >
      {direction < 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  );
  return (
    <div
      className="minimap-slide-browser"
      data-windowed={windowed}
      data-browsing={browsing}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setBrowsing(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          stop();
          setBrowsing(false);
          if (!contextMenuOpen) center();
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") setBrowsing(true);
      }}
      onFocusCapture={() => setBrowsing(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          stop();
          setBrowsing(false);
          if (!contextMenuOpen) center();
        }
      }}
    >
      {windowed && scrollButton(-1)}
      <div
        ref={viewport}
        className="minimap-slides"
        data-windowed={windowed}
        aria-label={`Slides in ${title}`}
        role="group"
        tabIndex={windowed ? 0 : undefined}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const element = viewport.current!;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            element.scrollBy({
              top: (event.key === "ArrowUp" ? -1 : 1) * rowHeight.current,
              behavior: "smooth",
            });
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            element.scrollTo({
              top: event.key === "Home" ? 0 : element.scrollHeight,
              behavior: "smooth",
            });
          }
        }}
      >
        <div className="minimap-slide-rows">
          {slides.map((slide, index) => (
            <button
              className="minimap-slide"
              key={slide.get("id")}
              {...hint(
                slide.get("id"),
                `${title} · Slide ${index + 1}: ${slide.get("title")?.toString() || "Untitled slide"}`,
              )}
              aria-label={`Map: slide ${index + 1}`}
              aria-current={active && index === selectedIndex}
              onClick={() => onNavigate(slide.get("id"))}
            >
              <span>{index + 1}</span>
              <div className="minimap-slide-content">
                <span className="minimap-slide-title">
                  {slide.get("title")?.toString() || "Untitled slide"}
                </span>
                <SlidePreview slide={slide} />
              </div>
            </button>
          ))}
        </div>
      </div>
      {windowed && scrollButton(1)}
    </div>
  );
}
