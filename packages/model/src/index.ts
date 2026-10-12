import * as Y from "yjs";
export * from "./references";
export type BlockKind = "doc" | "canvas" | "slides" | "sheet";
export type SlideLayout = "title" | "content";
export type SharedRecord = Y.Map<any>;
export type ShapeKind = "rect" | "ellipse" | "arrow" | "pen" | "text" | "pin";
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
  link?: string;
};
export const BLOCK_META = {
  doc: {
    name: "Doc",
    description: "Rich text and Markdown.",
    color: "#4f83cf",
  },
  canvas: {
    name: "Canvas",
    description: "Shapes, drawings, and pins.",
    color: "#cf6658",
  },
  slides: {
    name: "Slides",
    description: "Slides with text or canvas content.",
    color: "#d0a536",
  },
  sheet: {
    name: "Sheet",
    description: "Cells, formulas, and references.",
    color: "#6d947d",
  },
} as const;
export const LOCAL_ORIGIN = "office-local";
export function blocks(doc: Y.Doc): Y.Array<SharedRecord> {
  return doc.getArray<SharedRecord>("blocks");
}
export type BlockMove = {
  block: string;
  before: string | null;
  after: string | null;
};
export function blockMoves(doc: Y.Doc): Y.Array<BlockMove> {
  return doc.getArray<BlockMove>("blockMoves");
}
export function orderedBlocks(doc: Y.Doc): SharedRecord[] {
  const result = blocks(doc).toArray();
  for (const move of blockMoves(doc).toArray()) {
    const index = result.findIndex((block) => block.get("id") === move.block);
    if (index < 0) continue;
    const [block] = result.splice(index, 1);
    const before = result.findIndex((item) => item.get("id") === move.before);
    const after = result.findIndex((item) => item.get("id") === move.after);
    result.splice(
      before >= 0
        ? before
        : after >= 0
          ? after + 1
          : move.after === null
            ? 0
            : result.length,
      0,
      block,
    );
  }
  return result;
}
export function moveBlock(
  doc: Y.Doc,
  id: string,
  beforeID: string | null,
): boolean {
  const list = orderedBlocks(doc);
  const index = list.findIndex((block) => block.get("id") === id);
  if (index < 0 || beforeID === id) return false;
  const remaining = list.filter((block) => block.get("id") !== id);
  const before = remaining.findIndex((block) => block.get("id") === beforeID);
  const target = before < 0 ? remaining.length : before;
  if (target === index) return false;
  doc.transact(
    () =>
      blockMoves(doc).push([
        {
          block: id,
          before: remaining[target]?.get("id") ?? null,
          after: remaining[target - 1]?.get("id") ?? null,
        },
      ]),
    LOCAL_ORIGIN,
  );
  return true;
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
        slides: "Untitled slides",
        sheet: "Untitled sheet",
      }[kind],
  });
  if (kind === "doc") block.set("content", new Y.XmlFragment());
  if (kind === "canvas") block.set("shapes", new Y.Map<SharedRecord>());
  if (kind === "slides") {
    const slides = new Y.Array<SharedRecord>();
    slides.push([createSlide("title", id + "-title")]);
    block.set("slides", slides);
    block.set("slideMoves", new Y.Array<BlockMove>());
  }
  if (kind === "sheet") initializeSheet(block);
  return block;
}
export function addBlock(
  doc: Y.Doc,
  kind: BlockKind,
  index = blocks(doc).length,
  title?: string,
) {
  const block = createBlock(kind, title);
  const current = orderedBlocks(doc);
  index = Math.max(0, Math.min(index, current.length));
  doc.transact(() => {
    const moves = blockMoves(doc);
    if (moves.length) {
      blocks(doc).push([block]);
      moves.push([
        {
          block: block.get("id"),
          before: current[index]?.get("id") ?? null,
          after: current[index - 1]?.get("id") ?? null,
        },
      ]);
    } else blocks(doc).insert(index, [block]);
  }, LOCAL_ORIGIN);
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
  slide.set("title", title);
  const subtitle = new Y.Text();
  slide.set("subtitle", subtitle);
  slide.set("contentKind", "doc");
  slide.set("content", new Y.XmlFragment());
  slide.set("shapes", new Y.Map<SharedRecord>());
  slide.set("links", new Y.Map<string>());
  return slide;
}
export function addSlide(block: SharedRecord, layout: string, index?: number) {
  const slides = block.get("slides") as Y.Array<SharedRecord>;
  const slide = createSlide(layout);
  block.doc?.transact(() => {
    const ordered = orderedSlides(block);
    const at = index ?? ordered.length;
    if (slideMoves(block).length) {
      slides.push([slide]);
      slideMoves(block).push([
        {
          block: slide.get("id"),
          before: ordered[at]?.get("id") ?? null,
          after: ordered[at - 1]?.get("id") ?? null,
        },
      ]);
    } else slides.insert(at, [slide]);
  }, LOCAL_ORIGIN);
  return slide;
}
export function orderedSlides(block: SharedRecord): SharedRecord[] {
  return replayOrder(
    (block.get("slides") as Y.Array<SharedRecord>).toArray(),
    slideMoves(block).toArray(),
  );
}
export function slideMoves(block: SharedRecord): Y.Array<BlockMove> {
  return (
    block.get("slideMoves") ??
    block.doc?.getArray<BlockMove>(`slideMoves:${block.get("id")}`) ??
    new Y.Array<BlockMove>()
  );
}
export function replayOrder<T extends string | SharedRecord>(
  items: T[],
  moves: BlockMove[],
): T[] {
  const result = [...items];
  const id = (item: T) => (typeof item === "string" ? item : item.get("id"));
  for (const move of moves) {
    const at = result.findIndex((item) => id(item) === move.block);
    if (at < 0) continue;
    const [item] = result.splice(at, 1);
    const before = result.findIndex((item) => id(item) === move.before);
    const after = result.findIndex((item) => id(item) === move.after);
    result.splice(
      before >= 0
        ? before
        : after >= 0
          ? after + 1
          : move.after === null
            ? 0
            : result.length,
      0,
      item,
    );
  }
  return result;
}
export function moveSlide(
  block: SharedRecord,
  id: string,
  before: string | null,
) {
  const list = orderedSlides(block).filter((item) => item.get("id") !== id);
  if (
    !(block.get("slides") as Y.Array<SharedRecord>)
      .toArray()
      .some((item) => item.get("id") === id) ||
    id === before
  )
    return;
  const at =
    before === null
      ? list.length
      : list.findIndex((item) => item.get("id") === before);
  if (at < 0) return;
  block.doc?.transact(() => {
    slideMoves(block).push([
      { block: id, before, after: list[at - 1]?.get("id") ?? null },
    ]);
  }, LOCAL_ORIGIN);
}
export function initializeSheet(
  block: SharedRecord,
  rowCount = 100,
  columnCount = 12,
) {
  const rows = new Y.Array<string>();
  const columns = new Y.Array<string>();
  rows.push(Array.from({ length: rowCount }, () => crypto.randomUUID()));
  columns.push(Array.from({ length: columnCount }, () => crypto.randomUUID()));
  block.set("rows", rows);
  block.set("columns", columns);
  block.set("rowMoves", new Y.Array<BlockMove>());
  block.set("columnMoves", new Y.Array<BlockMove>());
  block.set("cells", new Y.Map<SharedRecord>());
}
export function sheetAxis(
  block: SharedRecord,
  axis: "rows" | "columns",
): string[] {
  return replayOrder(
    (block.get(axis) as Y.Array<string>).toArray(),
    block.get(axis === "rows" ? "rowMoves" : "columnMoves")?.toArray() ?? [],
  );
}
export function cellID(
  block: SharedRecord,
  column: number,
  row: number,
): string | null {
  const r = sheetAxis(block, "rows")[row],
    c = sheetAxis(block, "columns")[column];
  return r && c ? `${r}~${c}` : null;
}
export function cellPosition(
  block: SharedRecord,
  id: string,
): [number, number] | null {
  const [r, c] = id.split("~");
  const row = sheetAxis(block, "rows").indexOf(r),
    column = sheetAxis(block, "columns").indexOf(c);
  return row >= 0 && column >= 0 ? [column, row] : null;
}
export function columnLabel(index: number): string {
  let label = "";
  for (index++; index > 0; index = Math.floor((index - 1) / 26))
    label = String.fromCharCode(65 + ((index - 1) % 26)) + label;
  return label;
}
export function cellAddress(column: number, row: number) {
  return `${columnLabel(column)}${row + 1}`;
}
export function parseAddress(address: string): [number, number] | null {
  const match = /^\$?([A-Z]+)\$?([1-9]\d*)$/i.exec(address);
  if (!match) return null;
  const column =
    [...match[1].toUpperCase()].reduce(
      (n, letter) => n * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1;
  return [column, Number(match[2]) - 1];
}
export function editSheetAxis(
  block: SharedRecord,
  axis: "rows" | "columns",
  action: "insert" | "delete" | "move",
  index: number,
  before?: number,
) {
  const shared = block.get(axis) as Y.Array<string>;
  const moves = block.get(
    axis === "rows" ? "rowMoves" : "columnMoves",
  ) as Y.Array<BlockMove>;
  const list = sheetAxis(block, axis);
  block.doc?.transact(() => {
    if (action === "delete") {
      if (list.length <= 1 || !list[index]) return;
      shared.delete(shared.toArray().indexOf(list[index]), 1);
    } else {
      const id = action === "insert" ? crypto.randomUUID() : list[index];
      if (!id) return;
      const remaining = list.filter((item) => item !== id);
      const at = Math.max(
        0,
        Math.min(
          action === "insert" ? index : (before ?? remaining.length),
          remaining.length,
        ),
      );
      if (action === "insert") shared.push([id]);
      moves.push([
        {
          block: id,
          before: remaining[at] ?? null,
          after: remaining[at - 1] ?? null,
        },
      ]);
    }
  }, LOCAL_ORIGIN);
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
export function makeUndoManager(
  type: Y.AbstractType<any> | Y.AbstractType<any>[],
) {
  return new Y.UndoManager(type, {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: 400,
  });
}
