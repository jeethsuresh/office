import { useRef, type ButtonHTMLAttributes } from "react";

// Pointer-up activation also works after a native gesture suppresses the next
// compatibility click. Mouse and keyboard retain their usual click behavior.
export function TouchButton({
  onActivate,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onActivate: () => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const suppressUntil = useRef(0);
  return (
    <button
      {...props}
      onPointerDown={(event) => {
        if (event.pointerType === "touch")
          touch.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (
          touch.current &&
          Math.hypot(
            event.clientX - touch.current.x,
            event.clientY - touch.current.y,
          ) >= 6
        ) {
          touch.current = null;
          suppressUntil.current = performance.now() + 500;
        }
      }}
      onPointerCancel={() => {
        touch.current = null;
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== "touch" || !touch.current) return;
        touch.current = null;
        event.preventDefault();
        suppressUntil.current = performance.now() + 500;
        onActivate();
      }}
      onClick={(event) => {
        if (event.detail === 0 || performance.now() >= suppressUntil.current)
          onActivate();
      }}
    />
  );
}
