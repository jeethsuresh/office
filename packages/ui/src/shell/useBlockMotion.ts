import { useLayoutEffect, useRef, useState } from "react";

// Move the mounted surfaces, rather than scrolling an ancestor of the editors.
// This leaves canvas gestures, inner note scrolling, and fixed fullscreen intact.
export function useBlockMotion(
  active: string,
  order: string,
  hydrated: boolean,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(active);
  const [moving, setMoving] = useState(false);
  const requested = useRef(false);

  function prepare(id: string) {
    requested.current =
      !!active &&
      id !== active &&
      !document.querySelector(".editor-fullscreen") &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  useLayoutEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const editor = root.querySelector<HTMLElement>(
      ".office-block.is-active .block-editor",
    );
    function measure() {
      if (!root) return;
      if (!editor) {
        root.style.setProperty("--block-step", "0px");
        return;
      }
      const style = getComputedStyle(root);
      const gap = parseFloat(style.getPropertyValue("--block-gap"));
      root.style.setProperty(
        "--block-step",
        `${editor.getBoundingClientRect().height + gap}px`,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (editor) observer.observe(editor);
    return () => observer.disconnect();
  }, [active, order, hydrated]);

  useLayoutEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (requested.current && position && order.split(",").includes(position)) {
      setMoving(true);
      // Establish the old positions, including newly inserted surfaces, before
      // setting the destination so CSS can interpolate a continuous movement.
      viewport.current?.getBoundingClientRect();
      frame = requestAnimationFrame(() => {
        setPosition(active);
        timer = setTimeout(() => setMoving(false), 440);
      });
    } else {
      setPosition(active);
      setMoving(false);
    }
    requested.current = false;
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [active, order, hydrated]);

  return { viewport, position, moving, prepare };
}
