import { describe, test, expect } from "bun:test";
import * as Y from "yjs";
import { readFileSync } from "node:fs";
import {
  blocks,
  addBlock,
  addSlide,
  putShape,
  updateShape,
  updateText,
  makeUndoManager,
  LOCAL_ORIGIN,
  orderedBlocks,
  blockMoves,
  moveBlock,
  removeBlock,
} from "../../packages/model/src";
function clone(doc: Y.Doc) {
  const other = new Y.Doc();
  Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
  return other;
}
function reconcile(a: Y.Doc, b: Y.Doc) {
  const ua = Y.encodeStateAsUpdate(a),
    ub = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, ub);
  Y.applyUpdate(b, ua);
}
describe("shared office model", () => {
  test("reordering keeps block/editor identity, supports insertion and removal, and replays after reload", () => {
    const doc = new Y.Doc();
    const a = addBlock(doc, "doc", 0, "A"),
      b = addBlock(doc, "canvas", 1, "B"),
      c = addBlock(doc, "slides", 2, "C");
    const content = a.get("content");
    moveBlock(doc, a.get("id"), null);
    expect(orderedBlocks(doc)).toEqual([b, c, a]);
    moveBlock(doc, c.get("id"), b.get("id"));
    moveBlock(doc, a.get("id"), c.get("id"));
    expect(orderedBlocks(doc)).toEqual([a, c, b]);
    expect(orderedBlocks(doc)[0].get("content")).toBe(content);
    const inserted = addBlock(doc, "doc", 1, "Inserted");
    expect(orderedBlocks(doc)).toEqual([a, inserted, c, b]);
    removeBlock(doc, c.get("id"));
    expect(orderedBlocks(doc)).toEqual([a, inserted, b]);
    expect(orderedBlocks(clone(doc)).map((block) => block.get("id"))).toEqual(
      [a, inserted, b].map((block) => block.get("id")),
    );
    doc.destroy();
  });
  test("concurrent moves, insertions, and text changes converge without cloning or losing blocks", () => {
    const a = new Y.Doc();
    const note = addBlock(a, "doc", 0, "Note"),
      canvas = addBlock(a, "canvas", 1, "Canvas"),
      deck = addBlock(a, "slides", 2, "Deck");
    const b = clone(a);
    moveBlock(a, deck.get("id"), note.get("id"));
    moveBlock(b, note.get("id"), null);
    const added = addBlock(a, "doc", 1, "New note");
    blocks(b).get(0).set("title", "Edited while moving");
    updateText(
      blocks(b).get(2).get("slides").get(0).get("title"),
      "Concurrent slide edit",
    );
    reconcile(a, b);
    expect(orderedBlocks(a).map((block) => block.toJSON())).toEqual(
      orderedBlocks(b).map((block) => block.toJSON()),
    );
    expect(new Set(orderedBlocks(a).map((block) => block.get("id"))).size).toBe(
      4,
    );
    expect(orderedBlocks(a)).toContain(note);
    expect(orderedBlocks(a)).toContain(canvas);
    expect(orderedBlocks(a)).toContain(added);
    expect(note.get("title")).toBe("Edited while moving");
    expect(deck.get("slides").get(0).get("title").toString()).toBe(
      "Concurrent slide edit",
    );
    a.destroy();
    b.destroy();
  });
  test("undoing a local move preserves remote movement and editor changes", () => {
    const a = new Y.Doc();
    const first = addBlock(a, "doc", 0, "A"),
      second = addBlock(a, "canvas", 1, "B"),
      third = addBlock(a, "slides", 2, "C");
    const b = clone(a);
    const undo = makeUndoManager([blocks(a), blockMoves(a)]);
    moveBlock(a, third.get("id"), first.get("id"));
    moveBlock(b, second.get("id"), first.get("id"));
    blocks(b).get(0).set("title", "Remote edit");
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    undo.undo();
    expect(orderedBlocks(a)).toEqual([second, first, third]);
    expect(first.get("title")).toBe("Remote edit");
    expect(blockMoves(a).length).toBe(1);
    undo.destroy();
    a.destroy();
    b.destroy();
  });
  test("concurrent offline block insertions converge without dropping either", () => {
    const a = new Y.Doc();
    addBlock(a, "doc");
    const b = clone(a);
    addBlock(a, "canvas", 1, "Alice draws");
    addBlock(b, "slides", 1, "Bob tells a story");
    reconcile(a, b);
    expect(blocks(a).toJSON()).toEqual(blocks(b).toJSON());
    expect(blocks(a).length).toBe(3);
    expect(
      blocks(a)
        .toArray()
        .map((b) => b.get("title")),
    ).toContain("Alice draws");
  });
  test("per-shape fields merge concurrent edits to the same object", () => {
    const a = new Y.Doc();
    const canvas = addBlock(a, "canvas");
    putShape(canvas.get("shapes"), {
      id: "shape",
      kind: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: "blue",
      fill: "none",
    });
    const b = clone(a);
    updateShape(canvas.get("shapes"), "shape", { x: 120 });
    updateShape(blocks(b).get(0).get("shapes"), "shape", { color: "red" });
    reconcile(a, b);
    const shape = canvas.get("shapes").get("shape").toJSON();
    expect(shape.x).toBe(120);
    expect(shape.color).toBe("red");
    expect(blocks(a).toJSON()).toEqual(blocks(b).toJSON());
  });
  test("concurrent slide insertion and text edits remain shared", () => {
    const a = new Y.Doc();
    const story = addBlock(a, "slides");
    const b = clone(a);
    const slideA = story.get("slides").get(0),
      slideB = blocks(b).get(0).get("slides").get(0);
    updateText(slideA.get("title"), "Alice: A new perspective");
    updateText(slideB.get("title"), "A new perspective — Bob");
    addSlide(story, "content");
    addSlide(blocks(b).get(0), "title");
    reconcile(a, b);
    expect(blocks(a).toJSON()).toEqual(blocks(b).toJSON());
    expect(story.get("slides").length).toBe(3);
    const title = slideA.get("title").toString();
    expect(title).toContain("Alice");
    expect(title).toContain("Bob");
  });
  test("undo is scoped to local changes and retains remote shapes", () => {
    const a = new Y.Doc();
    const block = addBlock(a, "canvas");
    const b = clone(a);
    const undo = makeUndoManager(block.get("shapes"));
    putShape(block.get("shapes"), {
      id: "local",
      kind: "rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: "blue",
      fill: "none",
    });
    putShape(blocks(b).get(0).get("shapes"), {
      id: "remote",
      kind: "ellipse",
      x: 50,
      y: 50,
      width: 10,
      height: 10,
      color: "red",
      fill: "none",
    });
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    undo.undo();
    expect(block.get("shapes").has("local")).toBe(false);
    expect(block.get("shapes").has("remote")).toBe(true);
    undo.destroy();
  });
  test("server welcome snapshot is valid, complete, and replay-idempotent", () => {
    const doc = new Y.Doc();
    const seed = readFileSync(
      new URL("../../backend/internal/store/welcome.bin", import.meta.url),
    );
    Y.applyUpdate(doc, seed);
    Y.applyUpdate(doc, seed);
    expect(blocks(doc).length).toBe(3);
    expect(blocks(doc).get(0).get("content").toString()).toContain(
      "Good things happen",
    );
    expect(blocks(doc).get(1).get("shapes").size).toBe(6);
    expect(blocks(doc).get(2).get("slides").length).toBe(2);
  });
});
