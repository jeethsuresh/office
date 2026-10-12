import { createContext, useContext } from "react";
import type { SharedRecord } from "@office/model";
import type * as Y from "yjs";

export type NavigationItem = {
  block: string;
  slide?: string;
  title: string;
  kind: string;
  number: number;
};
export type DocumentNavigation = {
  blocks: SharedRecord[];
  active: string;
  activeSlides: Record<string, string>;
  onNavigate: (block: string, slide?: string) => void;
  onMove?: (block: string, before: string | null) => void;
  onAddAt?: (before: string | null) => void;
};
export const DocumentNavigationContext =
  createContext<DocumentNavigation | null>(null);
export const useDocumentNavigation = () =>
  useContext(DocumentNavigationContext);
export function navigationItems(blocks: SharedRecord[]): NavigationItem[] {
  return blocks.flatMap((block, index) => {
    const base = {
      block: block.get("id"),
      kind: block.get("kind"),
      title: block.get("title") || "Untitled block",
      number: index + 1,
    };
    const slides = block.get("slides") as Y.Array<SharedRecord> | undefined;
    if (base.kind !== "slides" || !slides?.length) return [base];
    return slides.toArray().map((slide, i) => ({
      ...base,
      slide: slide.get("id"),
      title: slide.get("title")?.toString() || `Slide ${i + 1}`,
      number: i + 1,
    }));
  });
}
