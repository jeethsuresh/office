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
