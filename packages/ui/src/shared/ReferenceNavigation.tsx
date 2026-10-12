import { useEffect, useRef } from "react";
import { parseURN, referenceURN } from "@office/model";
import { useOfficeData, useOfficeRevision } from "./OfficeData";
import { useFullscreenController } from "./Fullscreen";
import { useDocumentNavigation } from "./DocumentNavigation";
export function ReferenceNavigation() {
  const data = useOfficeData(),
    revision = useOfficeRevision(),
    navigation = useDocumentNavigation(),
    fullscreen = useFullscreenController();
  const last = useRef("");
  useEffect(() => {
    const navigate = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      if (
        params.get("document") !== data.root.id ||
        !params.has("target") ||
        !navigation
      )
        return;
      const urn = referenceURN({
        document: data.root.id,
        block: params.get("block") ?? "_",
        identifier: params.get("target")!,
      });
      if (last.current === location.hash) return;
      const target = data.resolve(urn);
      if (!target) return;
      last.current = location.hash;
      if (target.block !== "_") {
        const slide =
          target.kind === "slide" ? target.identifier : target.slide;
        if (fullscreen?.target) fullscreen.navigate(target.block, slide);
        else navigation.onNavigate(target.block, slide);
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent("office:focus-target", { detail: target }),
          );
          const element = document.querySelector<HTMLElement>(
            `[data-office-anchor="${CSS.escape(target.identifier)}"]`,
          );
          element?.scrollIntoView({ block: "center", behavior: "smooth" });
          if (element) {
            element.classList.add("link-target-flash");
            setTimeout(
              () => element.classList.remove("link-target-flash"),
              1600,
            );
          }
        }),
      );
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [data, revision, navigation, fullscreen]);
  return null;
}
