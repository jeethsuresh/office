import { useEffect, useRef } from "react";
import { referenceURN } from "@office/model";
import { useOfficeData, useOfficeRevision } from "./OfficeData";
import { useFullscreenController } from "./Fullscreen";
import { useDocumentNavigation } from "./DocumentNavigation";
export function ReferenceNavigation() {
  const data = useOfficeData(),
    revision = useOfficeRevision(),
    navigation = useDocumentNavigation(),
    fullscreen = useFullscreenController();
  const last = useRef("");
  const pendingFrame = useRef(0);
  const highlighted = useRef<HTMLElement | null>(null);
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearAttention = () => {
    cancelAnimationFrame(pendingFrame.current);
    clearTimeout(highlightTimeout.current);
    highlighted.current?.classList.remove("link-target-flash");
    highlighted.current = null;
  };

  useEffect(() => clearAttention, []);
  useEffect(() => {
    const navigate = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      if (
        params.get("document") !== data.root.id ||
        !params.has("target") ||
        !navigation
      ) {
        last.current = "";
        clearAttention();
        return;
      }
      const urn = referenceURN({
        document: data.root.id,
        block: params.get("block") ?? "_",
        identifier: params.get("target")!,
      });
      if (last.current === location.hash) return;
      const target = data.resolve(urn);
      if (!target) return;
      const destination = location.hash;
      last.current = destination;
      clearAttention();
      if (target.block !== "_") {
        const slide =
          target.kind === "slide" ? target.identifier : target.slide;
        if (fullscreen?.target) fullscreen.navigate(target.block, slide);
        else navigation.onNavigate(target.block, slide);
      }
      const deadline = performance.now() + 1800;
      const revealTarget = () => {
        if (last.current !== destination || location.hash !== destination) return;
        if (document.querySelector(".block-viewport.is-navigating")) {
          if (performance.now() < deadline) {
            pendingFrame.current = requestAnimationFrame(revealTarget);
          }
          return;
        }
        window.dispatchEvent(new CustomEvent("office:focus-target", { detail: target }));
        const block = target.block === "_" ? null : document.querySelector<HTMLElement>(
          `.office-block.is-active[data-block-id="${CSS.escape(target.block)}"]`,
        );
        const anchor = target.identifier === "_" ? null : block?.querySelector<HTMLElement>(
          `[data-office-anchor="${CSS.escape(target.identifier)}"]`,
        );
        const surface = anchor ?? block?.querySelector<HTMLElement>(".block-heading");
        if (!surface) return;
        if (anchor) anchor.scrollIntoView({ block: "nearest", behavior: "instant" });
        highlighted.current = surface;
        surface.classList.add("link-target-flash");
        highlightTimeout.current = setTimeout(() => {
          surface.classList.remove("link-target-flash");
          if (highlighted.current === surface) highlighted.current = null;
        }, 780);
      };
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = requestAnimationFrame(revealTarget);
      });
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [data, revision, navigation, fullscreen]);
  return null;
}
