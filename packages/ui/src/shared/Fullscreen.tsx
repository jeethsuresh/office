import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import type * as Y from "yjs";
import { orderedSlides, type SharedRecord } from "@office/model";
import {
  DocumentNavigationContext,
  type DocumentNavigation,
} from "./DocumentNavigation";
import { FullscreenNavigator } from "./FullscreenNavigator";
import { Maximize2, X } from "lucide-react";
import { ToolButton } from "./Toolbar";

// Promote the existing DOM subtree: collaboration, selection, and local canvas
// view state stay attached to the same editor throughout the transition.
function useStandaloneFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const native = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const scroll = useRef<{ element: HTMLElement; top: number; left: number }[]>(
    [],
  );
  const entering = useRef(false);
  const desired = useRef(false);

  function restore() {
    desired.current = false;
    setActive(false);
    native.current = false;
  }
  async function exit() {
    desired.current = false;
    if (document.fullscreenElement === ref.current) {
      await window.office?.waitForFullscreen?.();
      if (document.fullscreenElement === ref.current)
        await document.exitFullscreen().catch(() => {});
    }
    restore();
  }
  function enter() {
    const element = ref.current;
    if (!element || document.querySelector(".editor-fullscreen")) return;
    previousFocus.current = document.activeElement as HTMLElement;
    scroll.current = [
      ...element.querySelectorAll<HTMLElement>(
        ".doc-paper, .tool-list, .slide-track",
      ),
    ].map((element) => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    }));
    desired.current = true;
    setActive(true);
    // Mobile browsers without the API still get the same viewport focus mode.
    if (document.fullscreenEnabled && element.requestFullscreen) {
      entering.current = true;
      element
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          native.current = document.fullscreenElement === element;
          if (!desired.current && native.current) void exit();
        })
        .catch(() => {})
        .finally(() => {
          entering.current = false;
        });
    }
  }

  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    for (
      let node: HTMLElement | null = root;
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
    root
      .querySelector<HTMLElement>("[data-fullscreen-exit]")
      ?.focus({ preventScroll: true });
    const change = () => {
      if (document.fullscreenElement === root) native.current = true;
      else if (native.current) restore();
    };
    const key = (event: KeyboardEvent) => {
      // A nested native dialog gets Escape first (Markdown, canvas labels, etc.).
      if (root.querySelector("dialog[open], [role=dialog][aria-modal=true]"))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void exit();
      }
      if (event.key === "Tab") {
        const items = [
          ...root.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, textarea, select, [contenteditable=true], [tabindex='0']",
          ),
        ].filter(
          (el) => !el.closest("[inert]") && el.getClientRects().length > 0,
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
        element.inert = inert;
      });
      if (document.fullscreenElement === root && !entering.current)
        void document.exitFullscreen().catch(() => {});
      requestAnimationFrame(() => {
        scroll.current.forEach(({ element, top, left }) =>
          element.scrollTo({ top, left, behavior: "instant" }),
        );
        if (previousFocus.current?.isConnected)
          previousFocus.current.focus({ preventScroll: true });
      });
    };
  }, [active]);
  return {
    ref,
    active,
    enter,
    exit,
    className: active ? "editor-fullscreen" : "",
  };
}

type FocusedEditor = { id: string; element: HTMLDivElement };
type FullscreenController = {
  target: FocusedEditor | null;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  register: (id: string, element: HTMLDivElement) => () => void;
  enter: (id: string, element: HTMLDivElement) => void;
  exit: () => Promise<void>;
  navigate: (block: string, slide?: string) => void;
};
const FullscreenContext = createContext<FullscreenController | null>(null);
export const useFullscreenController = () => useContext(FullscreenContext);

export function EditorFullscreenProvider({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: DocumentNavigation;
}) {
  const host = useRef<HTMLDivElement>(null);
  const registry = useRef(new Map<string, HTMLDivElement>());
  const [target, setTarget] = useState<FocusedEditor | null>(null);
  const current = useRef(target);
  current.current = target;
  const [expanded, setExpanded] = useState(false);
  const native = useRef(false);
  const desired = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const scroll = useRef(new Map<HTMLElement, { top: number; left: number }>());
  const register = useCallback((id: string, element: HTMLDivElement) => {
    registry.current.set(id, element);
    return () => {
      if (registry.current.get(id) === element) registry.current.delete(id);
    };
  }, []);
  function remember(element: HTMLElement) {
    for (const el of element.querySelectorAll<HTMLElement>(
      ".doc-paper, .tool-list",
    )) {
      if (!scroll.current.has(el))
        scroll.current.set(el, { top: el.scrollTop, left: el.scrollLeft });
    }
  }
  function restore() {
    desired.current = false;
    native.current = false;
    setExpanded(false);
    setTarget(null);
  }
  async function exit() {
    desired.current = false;
    if (document.fullscreenElement === host.current) {
      await window.office?.waitForFullscreen?.();
      if (document.fullscreenElement === host.current)
        await document.exitFullscreen().catch(() => {});
    }
    restore();
  }
  function enter(id: string, element: HTMLDivElement) {
    if (!host.current) return;
    const first = !current.current;
    if (first) {
      restoreFocus.current = document.activeElement as HTMLElement;
      scroll.current.clear();
      setExpanded(false);
    }
    remember(element);
    desired.current = true;
    setTarget({ id, element });
    if (
      first &&
      document.fullscreenEnabled &&
      typeof host.current.requestFullscreen === "function"
    ) {
      const container = host.current;
      container
        .requestFullscreen({ navigationUI: "hide" })
        .then(() => {
          native.current = document.fullscreenElement === container;
          if (!desired.current && native.current) void exit();
        })
        .catch(() => {});
    }
  }
  function navigate(blockID: string, slideID?: string) {
    const block = navigation.blocks.find((b) => b.get("id") === blockID);
    if (!block) return;
    let id = `block:${blockID}`;
    if (slideID) {
      const slide = orderedSlides(block).find((s) => s.get("id") === slideID);
      if (!slide) return;
      const embedded = current.current?.id.match(/:(doc|canvas)$/);
      const deck = current.current?.id === `block:${blockID}`;
      if (!deck) id = `slide:${slideID}`;
      if (embedded && slide.get("layout") === "content")
        id = `slide:${slideID}:${slide.get("contentKind")}`;
    }
    const element = registry.current.get(id);
    if (!element) return;
    remember(element);
    // Selection, the visible card, and the focus target commit together before
    // paint. The native fullscreen host never changes during navigation.
    flushSync(() => {
      navigation.onNavigate(blockID, slideID);
      setTarget({ id, element });
    });
  }
  useLayoutEffect(() => {
    const focused = current.current;
    if (!focused) return;
    const selected =
      navigation.blocks.find((b) => b.get("id") === navigation.active) ??
      navigation.blocks[0];
    if (!selected) return;
    const block =
      focused.element.closest<HTMLElement>("[data-block-id]")?.dataset.blockId;
    const blockID = selected.get("id") as string;
    if (!focused.element.isConnected || (block && block !== blockID)) {
      const id = `block:${blockID}`;
      const element = registry.current.get(id);
      if (!element) return;
      remember(element);
      // Deletion detaches the old editor before selection catches up. Follow a
      // surviving block before the passive cleanup can exit native fullscreen.
      current.current = { id, element };
      navigation.onNavigate(blockID);
      setTarget(current.current);
    }
  });
  useLayoutEffect(() => {
    if (!target) return;
    const root = target.element;
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    for (
      let node: HTMLElement | null = root;
      node?.parentElement;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (
          sibling !== node &&
          sibling instanceof HTMLElement &&
          !sibling.matches(
            "[data-block-id], [data-slide-id], [data-office-portal]",
          )
        ) {
          siblings.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
    }
    const focus = expanded
      ? root.querySelector<HTMLElement>(".fullscreen-map [aria-current='true']")
      : root.querySelector<HTMLElement>("[data-fullscreen-exit]");
    focus?.focus({ preventScroll: true });
    return () =>
      siblings.forEach(({ element, inert }) => {
        element.inert = inert;
      });
  }, [target]);
  const focusing = !!target;
  useEffect(() => {
    if (!focusing) return;
    const container = host.current!;
    const change = () => {
      if (document.fullscreenElement === container) native.current = true;
      else if (native.current) restore();
    };
    const key = (event: KeyboardEvent) => {
      const root = current.current?.element;
      if (
        !root ||
        container.querySelector("dialog[open], [role=dialog][aria-modal=true]")
      )
        return;
      if (event.key === "Escape") {
        if (container.querySelector(".minimap.is-dragging")) return;
        if (container.querySelector(".minimap-context-menu")) return;
        if (root.querySelector(".slash-popover, .reference-picker")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void exit();
      }
      if (event.key === "Tab") {
        const items = [
          ...root.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, textarea, select, [contenteditable=true], [tabindex='0']",
          ),
        ].filter(
          (el) =>
            !el.closest("[inert]") &&
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== "hidden",
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
      if (document.fullscreenElement === container)
        void document.exitFullscreen().catch(() => {});
      requestAnimationFrame(() => {
        scroll.current.forEach((position, element) =>
          element.scrollTo({ ...position, behavior: "instant" }),
        );
        if (
          restoreFocus.current?.isConnected &&
          !restoreFocus.current.closest("[hidden], [inert]")
        )
          restoreFocus.current.focus({ preventScroll: true });
        else
          container
            .querySelector<HTMLElement>(
              ".office-block.is-active .fullscreen-enter button, .office-block.is-active button.fullscreen-enter",
            )
            ?.focus({ preventScroll: true });
      });
    };
  }, [focusing]);
  useEffect(() => {
    if (current.current && !current.current.element.isConnected) void exit();
  });
  return (
    <DocumentNavigationContext.Provider value={navigation}>
      <FullscreenContext.Provider
        value={{
          target,
          expanded,
          setExpanded,
          register,
          enter,
          exit,
          navigate,
        }}
      >
        <div
          ref={host}
          className={`fullscreen-host ${focusing ? "has-focused-editor" : ""}`}
        >
          {children}
        </div>
      </FullscreenContext.Provider>
    </DocumentNavigationContext.Provider>
  );
}

export function useEditorFullscreen(identity?: string) {
  const standalone = useStandaloneFullscreen();
  const scope = useFullscreenController();
  const unique = useId();
  const id = identity ?? unique;
  useLayoutEffect(() => {
    const element = standalone.ref.current;
    if (scope && element) return scope.register(id, element);
  });
  if (!scope) return standalone;
  const active = scope.target?.id === id;
  return {
    ref: standalone.ref,
    active,
    enter: () => {
      if (standalone.ref.current) scope.enter(id, standalone.ref.current);
    },
    exit: scope.exit,
    className: active ? "editor-fullscreen" : "",
  };
}

export type EditorFullscreen = ReturnType<typeof useEditorFullscreen>;
export function EditorTools({
  children,
  className,
  label,
  fullscreen,
  fullscreenLabel,
}: {
  children?: ReactNode;
  className?: string;
  label: string;
  fullscreen: EditorFullscreen;
  fullscreenLabel: string;
}) {
  const scope = useFullscreenController();
  const expanded = fullscreen.active && !!scope?.expanded;
  return (
    <div
      className={`editor-tools ${className ?? ""} ${expanded ? "map-expanded" : ""}`}
      aria-label={label}
    >
      <div className="tool-list" inert={expanded}>
        {children}
      </div>
      {fullscreen.active && scope && <FullscreenNavigator />}
      <div className="tool-footer">
        {fullscreen.active ? (
          <button
            type="button"
            className="tool-button fullscreen-exit"
            data-fullscreen-exit
            aria-label="Exit fullscreen"
            title="Exit fullscreen (Escape)"
            onClick={() => void fullscreen.exit()}
          >
            <X size={19} />
          </button>
        ) : (
          <div className="fullscreen-enter">
            <ToolButton label={fullscreenLabel} onClick={fullscreen.enter}>
              <Maximize2 size={17} />
            </ToolButton>
          </div>
        )}
      </div>
    </div>
  );
}
