import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

export function useMinimapDrag(
  track: RefObject<HTMLDivElement | null>,
  onMove?: (block: string, before: string | null) => void,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [before, setBefore] = useState<string | null>(null);
  const pending = useRef<{
    id: string;
    x: number;
    y: number;
    pointer: number;
    element: HTMLButtonElement;
    moved: boolean;
  } | null>(null);
  const currentY = useRef(0);
  const target = useRef<string | null>(null);
  const frame = useRef(0);
  const suppress = useRef(false);
  function findGap(y: number) {
    const sections = [
      ...(track.current?.querySelectorAll<HTMLElement>(".minimap-segment") ??
        []),
    ];
    const section = sections.find((element) => {
      const bounds = element.getBoundingClientRect();
      return y < bounds.top + bounds.height / 2;
    });
    target.current = section?.dataset.mapBlock ?? null;
    setBefore(target.current);
  }
  function cancel() {
    cancelAnimationFrame(frame.current);
    const pointer = pending.current;
    pending.current = null;
    if (pointer?.element.hasPointerCapture(pointer.pointer))
      pointer.element.releasePointerCapture(pointer.pointer);
    setDragging(null);
    setBefore(null);
    setTimeout(() => {
      suppress.current = false;
    }, 0);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (pending.current && event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      cancelAnimationFrame(frame.current);
    };
  }, []);
  function scroll() {
    const element = track.current;
    if (!element || !pending.current?.moved) return;
    const bounds = element.getBoundingClientRect();
    const distance =
      currentY.current < bounds.top + 30
        ? -5
        : currentY.current > bounds.bottom - 30
          ? 5
          : 0;
    if (distance) {
      element.scrollTop += distance;
      findGap(currentY.current);
    }
    frame.current = requestAnimationFrame(scroll);
  }
  return {
    dragging,
    before,
    click: () => !suppress.current,
    start(event: PointerEvent<HTMLButtonElement>, id: string) {
      if (
        !onMove ||
        event.button !== 0 ||
        !(event.target as Element).closest(".minimap-title, .minimap-number")
      )
        return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pending.current = {
        id,
        x: event.clientX,
        y: event.clientY,
        pointer: event.pointerId,
        element: event.currentTarget,
        moved: false,
      };
    },
    move(event: PointerEvent<HTMLButtonElement>) {
      const pointer = pending.current;
      if (!pointer || pointer.pointer !== event.pointerId) return;
      currentY.current = event.clientY;
      if (
        !pointer.moved &&
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 6
      ) {
        pointer.moved = true;
        suppress.current = true;
        setDragging(pointer.id);
        frame.current = requestAnimationFrame(scroll);
      }
      if (pointer.moved) findGap(event.clientY);
    },
    finish(event: PointerEvent<HTMLButtonElement>) {
      const pointer = pending.current;
      if (!pointer || pointer.pointer !== event.pointerId) return;
      const moved = pointer.moved;
      const destination = target.current;
      cancel();
      if (moved) {
        onMove?.(pointer.id, destination);
        pointer.element.focus({ preventScroll: true });
      }
      setTimeout(() => {
        suppress.current = false;
      }, 0);
    },
    cancel,
  };
}
