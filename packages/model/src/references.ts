import * as Y from "yjs";
import {
  orderedBlocks,
  orderedSlides,
  sheetAxis,
  cellID,
  cellPosition,
  cellAddress,
  LOCAL_ORIGIN,
  createRecord,
  updateText,
  type SharedRecord,
} from "./index";

export type Reference = { document: string; block: string; identifier: string };
export type Target = Reference & {
  urn: string;
  kind: "document" | "block" | "heading" | "slide" | "pin" | "cell";
  label: string;
  detail: string;
  slide?: string;
  value?: string;
};
export type Backlink = { source: Target; target: string };
export function referenceURN(reference: Reference): string {
  return [reference.document, reference.block, reference.identifier]
    .map(encodeURIComponent)
    .join(":");
}
export function parseURN(urn: string): Reference | null {
  const parts = urn.replace(/^urn:office:/, "").split(":");
  if (parts.length !== 3) return null;
  try {
    const [document, block, identifier] = parts.map(decodeURIComponent);
    return document && block && identifier
      ? { document, block, identifier }
      : null;
  } catch {
    return null;
  }
}
export function referenceURL(urn: string) {
  const reference = parseURN(urn);
  if (!reference) return "#";
  return `#${new URLSearchParams({ document: reference.document, block: reference.block, target: reference.identifier })}`;
}
export function xmlText(
  node: Y.XmlFragment | Y.XmlElement | Y.XmlText,
): string {
  if (node instanceof Y.XmlText)
    return node
      .toDelta()
      .map((part: { insert?: unknown }) =>
        typeof part.insert === "string" ? part.insert : "",
      )
      .join("");
  return node
    .toArray()
    .map((child) => xmlText(child as Y.XmlElement | Y.XmlText))
    .join("");
}
export function visitXML(
  fragment: Y.XmlFragment,
  callback: (element: Y.XmlElement) => void,
) {
  for (const node of fragment.toArray()) {
    if (!(node instanceof Y.XmlElement)) continue;
    callback(node);
    visitXML(node, callback);
  }
}
export function ensureHeadingIDs(doc: Y.Doc) {
  const headings: Y.XmlElement[] = [];
  const collect = (fragment: Y.XmlFragment) =>
    visitXML(fragment, (element) => {
      if (element.nodeName === "heading") headings.push(element);
    });
  for (const block of orderedBlocks(doc)) {
    if (block.get("kind") === "doc") collect(block.get("content"));
    if (block.get("kind") === "slides")
      for (const slide of orderedSlides(block)) collect(slide.get("content"));
  }
  const owners = new Map<string, Y.XmlElement>();
  for (const element of headings) {
    const id = element.getAttribute("officeID") as string | undefined,
      item = element._item;
    if (
      id &&
      item &&
      (!owners.has(id) || id === `h-${item.id.client}-${item.id.clock}`)
    )
      owners.set(id, element);
  }
  const ensure = (element: Y.XmlElement) => {
    if (element.nodeName !== "heading") return;
    const item = element._item;
    if (!item) return;
    const existing = element.getAttribute("officeID") as string | undefined;
    const id =
      existing && owners.get(existing) === element
        ? existing
        : `h-${item.id.client}-${item.id.clock}`;
    if (existing !== id) element.setAttribute("officeID", id);
  };
  doc.transact(() => {
    headings.forEach(ensure);
  }, "office-identities");
}
export function documentTargets(
  doc: Y.Doc,
  document: string,
  name: string,
): Target[] {
  const make = (
    block: string,
    identifier: string,
    kind: Target["kind"],
    label: string,
    detail: string,
    extras: Partial<Target> = {},
  ): Target => ({
    document,
    block,
    identifier,
    kind,
    label,
    detail,
    urn: referenceURN({ document, block, identifier }),
    ...extras,
  });
  const result = [make("_", "_", "document", name, "Document")];
  for (const block of orderedBlocks(doc)) {
    const id = block.get("id") as string,
      title = block.get("title") || "Untitled block";
    result.push(make(id, "_", "block", title, name));
    const headings = (fragment: Y.XmlFragment, slide?: string) =>
      visitXML(fragment, (element) => {
        const identifier = element.getAttribute("officeID") as string;
        if (element.nodeName === "heading" && identifier)
          result.push(
            make(
              id,
              identifier,
              "heading",
              xmlText(element) || "Untitled heading",
              `${name} / ${title}`,
              { slide },
            ),
          );
      });
    const pins = (shapes: Y.Map<SharedRecord>, slide?: string) => {
      for (const shape of shapes.values())
        if (shape.get("kind") === "pin")
          result.push(
            make(
              id,
              shape.get("id"),
              "pin",
              shape.get("text") || "Canvas pin",
              `${name} / ${title}`,
              { slide },
            ),
          );
    };
    if (block.get("kind") === "doc") headings(block.get("content"));
    if (block.get("kind") === "canvas") pins(block.get("shapes"));
    if (block.get("kind") === "slides")
      orderedSlides(block).forEach((slide, index) => {
        result.push(
          make(
            id,
            slide.get("id"),
            "slide",
            slide.get("title")?.toString() || "Untitled slide",
            `${name} / ${title} / Slide ${index + 1}`,
          ),
        );
        headings(slide.get("content"), slide.get("id"));
        pins(slide.get("shapes"), slide.get("id"));
      });
    if (block.get("kind") === "sheet") {
      for (const [identifier, cell] of (
        block.get("cells") as Y.Map<SharedRecord>
      ).entries()) {
        const position = cellPosition(block, identifier);
        if (position)
          result.push(
            make(
              id,
              identifier,
              "cell",
              cellAddress(...position),
              `${name} / ${title}`,
              { value: cell.get("input") || "" },
            ),
          );
      }
    }
  }
  return result;
}
export function resolveTarget(
  doc: Y.Doc,
  reference: Reference,
  name: string,
): Target | null {
  const urn = referenceURN(reference);
  const found = documentTargets(doc, reference.document, name).find(
    (target) => target.urn === urn,
  );
  if (found) return found;
  const block = orderedBlocks(doc).find(
    (block) => block.get("id") === reference.block,
  );
  if (block?.get("kind") === "sheet") {
    const position = cellPosition(block, reference.identifier);
    if (position)
      return {
        ...reference,
        urn,
        kind: "cell",
        label: cellAddress(...position),
        detail: `${name} / ${block.get("title")}`,
        value: "",
      };
  }
  return null;
}
export function outgoingLinks(
  doc: Y.Doc,
  document: string,
  name: string,
): Backlink[] {
  const targets = documentTargets(doc, document, name),
    result: Backlink[] = [];
  const push = (source: Target, target: unknown) => {
    if (typeof target === "string" && parseURN(target))
      result.push({ source, target });
  };
  for (const block of orderedBlocks(doc)) {
    const source = targets.find(
      (target) => target.block === block.get("id") && target.kind === "block",
    )!;
    const text = (fragment: Y.XmlFragment, owner: Target) =>
      visitXML(fragment, (element) => {
        if (element.nodeName === "officeReference")
          push(owner, element.getAttribute("urn"));
      });
    const pins = (shapes: Y.Map<SharedRecord>) => {
      for (const shape of shapes.values())
        push(
          targets.find((target) => target.identifier === shape.get("id")) ||
            source,
          shape.get("link"),
        );
    };
    if (block.get("kind") === "doc") text(block.get("content"), source);
    if (block.get("kind") === "canvas") pins(block.get("shapes"));
    if (block.get("kind") === "slides")
      for (const slide of orderedSlides(block)) {
        const owner = targets.find(
          (target) => target.identifier === slide.get("id"),
        )!;
        text(slide.get("content"), owner);
        pins(slide.get("shapes"));
        for (const urn of (
          slide.get("links") as Y.Map<string> | undefined
        )?.values() ?? [])
          push(owner, urn);
      }
    if (block.get("kind") === "sheet")
      for (const [identifier, cell] of block.get(
        "cells",
      ) as Y.Map<SharedRecord>) {
        const owner =
          targets.find((target) => target.identifier === identifier) || source;
        for (const match of ((cell.get("input") as string) || "").matchAll(
          /REF\("([^"]+)"\)/gi,
        ))
          push(owner, match[1]);
      }
  }
  return result;
}
export type OfficeOperation =
  | {
      type: "cell.set";
      block: string;
      identifier: string;
      input: string;
      formula?: unknown;
    }
  | {
      type: "record.set";
      block: string;
      identifier?: string;
      field: string;
      value: unknown;
    };
export type OfficeChangeset = {
  id: string;
  document: string;
  origin: unknown;
  affected: string[];
};
export class DocumentAPI {
  private listeners = new Set<(change: OfficeChangeset) => void>();
  private assigning = false;
  private disposed = false;
  constructor(
    readonly document: string,
    readonly doc: Y.Doc,
  ) {
    doc.on("afterTransaction", this.changed);
  }
  private changed = (transaction: Y.Transaction) => {
    if (!transaction.changed.size) return;
    if (!this.assigning) {
      this.assigning = true;
      queueMicrotask(() => {
        try {
          if (!this.disposed) ensureHeadingIDs(this.doc);
        } finally {
          this.assigning = false;
        }
      });
    }
    const affected = new Set<string>();
    for (const type of transaction.changedParentTypes.keys()) {
      if (type instanceof Y.Map && typeof type.get("id") === "string")
        affected.add(type.get("id"));
    }
    const change: OfficeChangeset = {
      id: crypto.randomUUID(),
      document: this.document,
      origin: transaction.origin,
      affected: [...affected],
    };
    [...this.listeners].forEach((listener) => listener(change));
  };
  subscribe(listener: (change: OfficeChangeset) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  readBlock(id: string) {
    return orderedBlocks(this.doc).find((block) => block.get("id") === id);
  }
  readRecord(blockID: string, identifier?: string): SharedRecord | undefined {
    const block = this.readBlock(blockID);
    if (!block || !identifier || identifier === "_") return block;
    if (block.get("kind") === "canvas")
      return block.get("shapes").get(identifier);
    if (block.get("kind") === "sheet")
      return block.get("cells").get(identifier);
    if (block.get("kind") === "slides") {
      for (const slide of orderedSlides(block)) {
        if (slide.get("id") === identifier) return slide;
        const shape = slide.get("shapes").get(identifier);
        if (shape) return shape;
      }
    }
    return undefined;
  }
  transact(operations: OfficeOperation[]) {
    for (const operation of operations) {
      const block = this.readBlock(operation.block);
      if (!block) throw new Error("Block no longer exists");
      if (
        operation.type === "cell.set" &&
        (block.get("kind") !== "sheet" ||
          !cellPosition(block, operation.identifier) ||
          operation.input.length > 20000)
      )
        throw new Error("Invalid cell operation");
      if (
        operation.type === "record.set" &&
        ["id", "kind", "officeID", "input", "formula"].includes(operation.field)
      )
        throw new Error("Persistent identity cannot be changed");
      if (operation.type === "record.set") {
        const record = this.readRecord(operation.block, operation.identifier);
        if (!record) throw new Error("Record no longer exists");
        const existing = record.get(operation.field);
        if (
          existing instanceof Y.AbstractType &&
          !(existing instanceof Y.Text && typeof operation.value === "string")
        )
          throw new Error(
            "Use the native shared-content adapter for this field",
          );
      }
    }
    this.doc.transact(() => {
      for (const operation of operations) {
        const block = this.readBlock(operation.block);
        if (!block) throw new Error("Block no longer exists");
        if (operation.type === "cell.set") {
          if (
            block.get("kind") !== "sheet" ||
            !cellPosition(block, operation.identifier)
          )
            throw new Error("Cell no longer exists");
          const cells = block.get("cells") as Y.Map<SharedRecord>;
          let cell = cells.get(operation.identifier);
          if (!cell) {
            cell = createRecord({ id: operation.identifier });
            cells.set(operation.identifier, cell);
          }
          cell.set("input", operation.input);
          cell.set("formula", operation.formula ?? null);
        } else {
          const record = this.readRecord(
            operation.block,
            operation.identifier,
          )!;
          const existing = record.get(operation.field);
          if (existing instanceof Y.Text && typeof operation.value === "string")
            updateText(existing, operation.value);
          else record.set(operation.field, operation.value);
        }
      }
    }, LOCAL_ORIGIN);
  }
  destroy() {
    this.disposed = true;
    this.doc.off("afterTransaction", this.changed);
    this.listeners.clear();
  }
}
