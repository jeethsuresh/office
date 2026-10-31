import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export function useSlideshow(
  root: RefObject<HTMLDivElement | null>,
  active: number,
  count: number,
  navigate: (index: number) => void,
) {
  const [presenting, setPresenting] = useState(false);
  const [blank, setBlank] = useState(false);
  const [native, setNative] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const exiting = useRef<Promise<void> | null>(null);
  const desired = useRef(false);
  const current = useRef({ active, count, navigate });
  current.current = { active, count, navigate };
  const exitNative = useCallback(() => {
    if (exiting.current) return exiting.current;
    if (document.fullscreenElement !== root.current) return Promise.resolve();
    exiting.current = (async () => {
      await window.office?.waitForFullscreen?.();
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen().catch(() => {});
    })().finally(() => {
      exiting.current = null;
    });
    return exiting.current;
  }, [root]);
  const close = useCallback(() => {
    desired.current = false;
    setPresenting(false);
    setBlank(false);
    setNative(false);
    void exitNative();
  }, [exitNative]);
  const start = () => {
    if (!count) return;
    desired.current = true;
    previousFocus.current = document.activeElement as HTMLElement;
    setBlank(false);
    setPresenting(true);
  };
  const fullscreen = () => {
    if (document.fullscreenEnabled && !document.fullscreenElement)
      void root.current
        ?.requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          if (!desired.current) void exitNative();
        })
        .catch(() => {});
  };
  useEffect(() => {
    if (presenting && !count) close();
  }, [presenting, count, close]);
  useEffect(() => {
    const element = root.current;
    if (!presenting || !element) return;
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    for (
      let node: HTMLElement | null = element;
      node?.parentElement;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
    }
    element
      .querySelector<HTMLElement>("[data-presentation-close]")
      ?.focus({ preventScroll: true });
    let wasNative = false;
    const change = () => {
      const ownsFullscreen = document.fullscreenElement === element;
      setNative(ownsFullscreen);
      if (wasNative && !ownsFullscreen) close();
      wasNative = ownsFullscreen;
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        element.querySelector("dialog[open]")
      )
        return;
      const state = current.current;
      const next = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(
        event.key,
      );
      const previous = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
      if (
        next ||
        previous ||
        ["Home", "End", "Escape", "b", "B"].includes(event.key)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Escape") close();
        else if (event.key.toLowerCase() === "b") setBlank((value) => !value);
        else
          state.navigate(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? state.count - 1
                : Math.max(
                    0,
                    Math.min(state.count - 1, state.active + (next ? 1 : -1)),
                  ),
          );
      }
      if (event.key === "Tab") {
        const items = [
          ...element.querySelectorAll<HTMLElement>(
            "button:not(:disabled), a[href], [tabindex='0']",
          ),
        ].filter(
          (item) =>
            !item.closest("[inert]") &&
            item.getClientRects().length &&
            getComputedStyle(item).visibility !== "hidden",
        );
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("fullscreenchange", change);
    window.addEventListener("keydown", key, true);
    return () => {
      desired.current = false;
      document.removeEventListener("fullscreenchange", change);
      window.removeEventListener("keydown", key, true);
      siblings.forEach(({ element, inert }) => {
        element.inert = inert || element.getAttribute("aria-hidden") === "true";
      });
      void exitNative().then(() =>
        requestAnimationFrame(() => {
          const previous = previousFocus.current;
          if (previous?.isConnected && !previous.closest("[inert], [hidden]"))
            previous.focus({ preventScroll: true });
        }),
      );
    };
  }, [presenting, root, close, exitNative]);
  return {
    presenting,
    blank,
    native,
    start,
    close,
    fullscreen,
    toggleBlank: () => setBlank((value) => !value),
  };
}
