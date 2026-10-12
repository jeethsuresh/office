import { test, expect } from "bun:test";
import * as Y from "yjs";
import {
  addBlock,
  blocks,
  blockUpdateClock,
  blockUpdatedAt,
  trackBlockUpdates,
  updateText,
  makeUndoManager,
} from "../../packages/model/src";

test("block timestamps persist, stay independent, ignore identity migration and remote replay, and advance on undo", async () => {
  const doc = new Y.Doc();
  const note = addBlock(doc, "doc"),
    deck = addBlock(doc, "slides");
  // Arbitrary persistent IDs must not share clock prefixes.
  note.set("id", "example");
  deck.set("id", "example:deck");
  let now = Date.now() + 1000;
  const stop = trackBlockUpdates(doc, () => now);
  const original = blockUpdatedAt(doc, note),
    deckOriginal = blockUpdatedAt(doc, deck);
  doc.transact(() => note.set("migration", true), "office-identities");
  await Promise.resolve();
  expect(blockUpdatedAt(doc, note)).toBe(original);
  note.set("title", "Edited");
  await Promise.resolve();
  expect(blockUpdatedAt(doc, note)).toBe(new Date(now).toISOString());
  expect(blockUpdatedAt(doc, deck)).toBe(deckOriginal);
  const title = deck.get("slides").get(0).get("title") as Y.Text;
  const undo = makeUndoManager(title);
  updateText(title, "A slide");
  await Promise.resolve();
  const beforeUndo = blockUpdatedAt(doc, deck);
  now += 1000;
  undo.undo();
  await Promise.resolve();
  expect(title.toString()).toBe("");
  expect(blockUpdatedAt(doc, deck)! > beforeUndo!).toBe(true);
  expect(blockUpdatedAt(doc, note)).toBe(new Date(now - 1000).toISOString());
  const replay = new Y.Doc();
  const stopReplay = trackBlockUpdates(replay, () => now + 999999);
  Y.applyUpdate(replay, Y.encodeStateAsUpdate(doc));
  await Promise.resolve();
  expect(blockUpdateClock(replay).toJSON()).toEqual(
    blockUpdateClock(doc).toJSON(),
  );
  expect(blockUpdatedAt(replay, blocks(replay).get(1))).toBe(
    blockUpdatedAt(doc, deck),
  );
  stop();
  stopReplay();
  undo.destroy();
  doc.destroy();
  replay.destroy();
});

test("offline timestamp clocks converge on the latest edit instead of a stale replay", async () => {
  const a = new Y.Doc(),
    note = addBlock(a, "doc");
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const late = Date.now() + 2000,
    early = late - 1000;
  const stopA = trackBlockUpdates(a, () => late),
    stopB = trackBlockUpdates(b, () => early);
  note.set("title", "Later");
  blocks(b).get(0).set("title", "Earlier");
  await Promise.resolve();
  const ua = Y.encodeStateAsUpdate(a),
    ub = Y.encodeStateAsUpdate(b);
  Y.applyUpdate(a, ub);
  Y.applyUpdate(b, ua);
  await Promise.resolve();
  expect(blockUpdatedAt(a, note)).toBe(new Date(late).toISOString());
  expect(blockUpdatedAt(b, blocks(b).get(0))).toBe(blockUpdatedAt(a, note));
  expect(blockUpdateClock(a).size).toBe(2);
  stopA();
  stopB();
  a.destroy();
  b.destroy();
});
