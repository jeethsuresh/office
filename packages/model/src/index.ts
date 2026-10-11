import * as Y from "yjs";
export type BlockKind = "doc" | "canvas" | "slides";
export type SlideLayout = "title" | "content";
export type SharedRecord = Y.Map<any>;
export type ShapeKind = "rect" | "ellipse" | "arrow" | "pen" | "text";
export type Shape = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fill: string;
  text?: string;
  points?: number[][];
};
export const BLOCK_META = {
  doc: {
    name: "Doc",
    description: "Write, think, and make a little sense of things.",
    color: "#4f83cf",
  },
  canvas: {
    name: "Canvas",
    description: "Give your ideas room to wander.",
    color: "#cf6658",
  },
  slides: {
    name: "Slides",
    description: "Turn a thought into a story, one slide at a time.",
    color: "#d0a536",
  },
} as const;
export const LOCAL_ORIGIN = "office-local";
export function blocks(doc: Y.Doc): Y.Array<SharedRecord> {
  return doc.getArray<SharedRecord>("blocks");
}
export function createRecord(values: Record<string, unknown> = {}) {
  const map = new Y.Map<any>();
  for (const [key, value] of Object.entries(values)) map.set(key, value);
  return map;
}
export function createBlock(
  kind: BlockKind,
  title?: string,
  id: string = crypto.randomUUID(),
): SharedRecord {
  const block = createRecord({
    id,
    kind,
    title:
      title ??
      {
        doc: "Untitled note",
        canvas: "Untitled canvas",
        slides: "Untitled story",
      }[kind],
  });
  if (kind === "doc") block.set("content", new Y.XmlFragment());
  if (kind === "canvas") block.set("shapes", new Y.Map<SharedRecord>());
  if (kind === "slides") {
    const slides = new Y.Array<SharedRecord>();
    slides.push([createSlide("title", id + "-title")]);
    block.set("slides", slides);
  }
  return block;
}
export function addBlock(
  doc: Y.Doc,
  kind: BlockKind,
  index = blocks(doc).length,
  title?: string,
) {
  const block = createBlock(kind, title);
  doc.transact(
    () =>
      blocks(doc).insert(Math.max(0, Math.min(index, blocks(doc).length)), [
        block,
      ]),
    LOCAL_ORIGIN,
  );
  return block;
}
export function removeBlock(doc: Y.Doc, id: string) {
  const list = blocks(doc);
  const index = list.toArray().findIndex((b) => b.get("id") === id);
  if (index >= 0) doc.transact(() => list.delete(index, 1), LOCAL_ORIGIN);
}
export function createSlide(
  layout: string,
  id: string = crypto.randomUUID(),
): SharedRecord {
  const slide = createRecord({ id, layout });
  const title = new Y.Text();
  title.insert(
    0,
    layout === "title" ? "A new perspective" : "The next chapter",
  );
  slide.set("title", title);
  const subtitle = new Y.Text();
  subtitle.insert(
    0,
    layout === "title" ? "Every great story starts with an idea." : "",
  );
  slide.set("subtitle", subtitle);
  slide.set("contentKind", "doc");
  slide.set("content", new Y.XmlFragment());
  slide.set("shapes", new Y.Map<SharedRecord>());
  return slide;
}
export function addSlide(block: SharedRecord, layout: string, index?: number) {
  const slides = block.get("slides") as Y.Array<SharedRecord>;
  const slide = createSlide(layout);
  block.doc?.transact(
    () => slides.insert(index ?? slides.length, [slide]),
    LOCAL_ORIGIN,
  );
  return slide;
}
export function updateText(text: Y.Text, value: string) {
  const before = text.toString();
  if (value === before) return;
  let start = 0;
  while (
    start < before.length &&
    start < value.length &&
    before[start] === value[start]
  )
    start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < value.length - start &&
    before[before.length - 1 - end] === value[value.length - 1 - end]
  )
    end++;
  text.doc?.transact(() => {
    const length = before.length - start - end;
    if (length) text.delete(start, length);
    const insert = value.slice(start, value.length - end);
    if (insert) text.insert(start, insert);
  }, LOCAL_ORIGIN);
}
export function putShape(shapes: Y.Map<SharedRecord>, shape: Shape) {
  shapes.doc?.transact(
    () => shapes.set(shape.id, createRecord(shape)),
    LOCAL_ORIGIN,
  );
}
export function updateShape(
  shapes: Y.Map<SharedRecord>,
  id: string,
  changes: Partial<Shape>,
) {
  const shape = shapes.get(id);
  if (!shape) return;
  shapes.doc?.transact(
    () => Object.entries(changes).forEach(([k, v]) => shape.set(k, v)),
    LOCAL_ORIGIN,
  );
}
export function shapeValues(shapes: Y.Map<SharedRecord>): Shape[] {
  return [...shapes.values()].map((shape) => shape.toJSON() as Shape);
}
export function makeUndoManager(type: Y.AbstractType<any>) {
  return new Y.UndoManager(type, {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 400,
  });
}
