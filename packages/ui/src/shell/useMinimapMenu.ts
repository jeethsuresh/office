import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

type BlockMenu = {
  block: string;
  left: number;
  top: number;
  source: HTMLElement;
};
export function useMinimapMenu(enabled: boolean, onOpen: () => void) {
  const [menu, setMenu] = useState<BlockMenu | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useRef<{
    block: string;
    pointer: number;
    x: number;
    y: number;
  } | null>(null);
  const ignoredClick = useRef<string | null>(null);
  function cancelHold() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    hold.current = null;
  }
  function close(restore = true) {
    const source = menu?.source;
    if (restore && source?.isConnected) source.focus({ preventScroll: true });
    setMenu(null);
  }
  function open(block: string, source: HTMLElement, y: number) {
    cancelHold();
    onOpen();
    const bounds = source.closest(".minimap")!.getBoundingClientRect();
    const left =
      bounds.left > innerWidth - bounds.right
        ? bounds.left - 232
        : bounds.right + 12;
    setMenu({
      block,
      source,
      left: Math.max(12, Math.min(left, innerWidth - 232)),
      top: Math.max(12, Math.min(y, innerHeight - 120)),
    });
  }
  useEffect(() => {
    if (!menu) return;
    element.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
    const outside = (event: globalThis.PointerEvent) => {
      if (!element.current?.contains(event.target as Node)) close(false);
    };
    const scroll = (event: Event) => {
      if (!element.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", scroll);
    };
  }, [menu]);
  useEffect(() => () => cancelHold(), []);
  return {
    menu,
    element,
    close,
    context(event: MouseEvent<HTMLDivElement>, block: string) {
      if (!enabled || (event.target as Element).closest(".minimap-gap")) return;
      event.preventDefault();
      event.stopPropagation();
      const source =
        (event.target as Element).closest<HTMLElement>("button") ??
        event.currentTarget.querySelector<HTMLButtonElement>(".minimap-block")!;
      open(block, source, event.clientY || source.getBoundingClientRect().top);
    },
    key(event: KeyboardEvent<HTMLDivElement>, block: string) {
      if (event.key === "Enter" || event.key === " ")
        ignoredClick.current = null;
      if (
        !enabled ||
        !(
          event.key === "ContextMenu" ||
          (event.shiftKey && event.key === "F10")
        )
      )
        return;
      if ((event.target as Element).closest(".minimap-gap")) return;
      event.preventDefault();
      event.stopPropagation();
      const source = event.target as HTMLElement;
      const bounds = source.getBoundingClientRect();
      open(block, source, bounds.top + bounds.height / 2);
    },
    start(event: PointerEvent<HTMLDivElement>, block: string) {
      ignoredClick.current = null;
      if (
        !enabled ||
        event.pointerType !== "touch" ||
        (event.target as Element).closest(".minimap-gap")
      )
        return;
      cancelHold();
      const source =
        (event.target as Element).closest<HTMLElement>("button") ??
        event.currentTarget.querySelector<HTMLButtonElement>(".minimap-block")!;
      hold.current = {
        block,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      timer.current = setTimeout(() => {
        ignoredClick.current = block;
        open(block, source, event.clientY);
      }, 550);
    },
    move(event: PointerEvent<HTMLDivElement>) {
      const current = hold.current;
      if (
        current &&
        (current.pointer !== event.pointerId ||
          Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 6)
      )
        cancelHold();
    },
    release: cancelHold,
    click(event: MouseEvent<HTMLDivElement>, block: string) {
      if (ignoredClick.current === block) {
        ignoredClick.current = null;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
