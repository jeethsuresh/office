import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Layout happens at one slide size. Only the completed surface scales, so
// editing, presenting, and resizing cannot change text wrapping or proportions.
export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

export function SlideViewport({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = root.current!;
    const measure = () => {
      const style = getComputedStyle(element);
      const width =
        element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height =
        element.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      if (width > 0 && height > 0)
        setScale(Math.min(width / SLIDE_WIDTH, height / SLIDE_HEIGHT));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="slide-viewport" ref={root}>
      <div
        className="slide-frame"
        style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}
      >
        <div
          className="slide-page"
          data-slide-scale={scale}
          style={{
            width: SLIDE_WIDTH,
            height: SLIDE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
