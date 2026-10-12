import { ChevronDown } from "lucide-react";
import { BLOCK_META, type BlockKind } from "@office/model";
import { useDocumentNavigation, navigationItems } from "./DocumentNavigation";
import { useFullscreenController } from "./Fullscreen";
import { Minimap } from "../shell/Minimap";

export function FullscreenNavigator() {
  const navigation = useDocumentNavigation();
  const scope = useFullscreenController();
  if (!navigation || !scope) return null;
  const items = navigationItems(navigation.blocks);
  const index = items.findIndex(
    (item) =>
      item.block === navigation.active &&
      (!item.slide || item.slide === navigation.activeSlides[item.block]),
  );
  const current =
    index >= 0
      ? index
      : items.findIndex((item) => item.block === navigation.active);
  function expand() {
    scope!.setExpanded(true);
    requestAnimationFrame(() =>
      scope!.target?.element
        .querySelector<HTMLElement>(".fullscreen-map [aria-current='true']")
        ?.focus({ preventScroll: true }),
    );
  }
  function collapse() {
    const focusedInside = document.activeElement?.closest(
      ".fullscreen-navigator",
    );
    scope!.setExpanded(false);
    if (focusedInside)
      requestAnimationFrame(() =>
        scope!.target?.element
          .querySelector<HTMLElement>(".fullscreen-map-peek")
          ?.focus({ preventScroll: true }),
      );
  }
  return (
    <div
      className={`fullscreen-navigator ${scope.expanded ? "is-expanded" : ""}`}
      aria-label="Fullscreen navigator"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") scope.setExpanded(true);
      }}
      onPointerLeave={(event) => {
        if (
          event.pointerType === "mouse" &&
          !event.currentTarget.querySelector(".minimap-context-menu")
        )
          collapse();
      }}
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Element) ||
          !event.relatedTarget.closest(".fullscreen-navigator")
        )
          scope.setExpanded(false);
      }}
    >
      {scope.expanded && (
        <Minimap
          {...navigation}
          onNavigate={scope.navigate}
          className="fullscreen-map"
          label="Fullscreen document minimap"
        />
      )}
      <button
        className="fullscreen-map-peek"
        aria-label={
          scope.expanded ? "Collapse fullscreen map" : "Expand fullscreen map"
        }
        aria-expanded={scope.expanded}
        onClick={scope.expanded ? collapse : expand}
      >
        {scope.expanded ? (
          <ChevronDown size={14} />
        ) : (
          [-1, 0, 1].map((offset) => {
            const item = items[current + offset];
            return (
              <span
                key={offset}
                className={`fullscreen-map-preview ${offset === 0 ? "current" : ""} ${item ? "" : "empty"}`}
                data-preview={
                  offset === 0 ? "current" : offset < 0 ? "previous" : "next"
                }
                title={item?.title}
                style={{
                  background: item
                    ? BLOCK_META[item.kind as BlockKind]?.color
                    : undefined,
                }}
              >
                {item?.number}
              </span>
            );
          })
        )}
      </button>
    </div>
  );
}
