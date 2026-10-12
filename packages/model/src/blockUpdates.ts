import * as Y from "yjs";
import { orderedBlocks, type SharedRecord } from "./index";

const UPDATE_ORIGIN = "office-block-updated";
export function blockUpdateClock(doc: Y.Doc) {
  return doc.getMap<number>("blockUpdatedAt");
}
export function blockUpdatedAt(doc: Y.Doc, block: SharedRecord) {
  const prefix = `${encodeURIComponent(block.get("id"))}:`;
  let latest = Date.parse(block.get("updatedAt") ?? "") || 0;
  for (const [key, time] of blockUpdateClock(doc))
    if (key.startsWith(prefix)) latest = Math.max(latest, time);
  return latest ? new Date(latest).toISOString() : undefined;
}

// Each client's clock is a separate CRDT key, so reconnecting an older edit
// cannot replace a later timestamp. Metadata is outside content undo scopes.
export function trackBlockUpdates(doc: Y.Doc, now = Date.now) {
  const clock = blockUpdateClock(doc);
  const pending = new Set<string>();
  let queued = false,
    disposed = false;
  const changed = (transaction: Y.Transaction) => {
    if (
      !transaction.changed.size ||
      !transaction.local ||
      transaction.origin === UPDATE_ORIGIN ||
      transaction.origin === "office-identities"
    )
      return;
    const parents = new Set<Y.AbstractType<any>>(
      transaction.changedParentTypes.keys(),
    );
    const list = orderedBlocks(doc);
    for (const block of list) {
      if (
        parents.has(block) ||
        (block.get("kind") === "slides" &&
          transaction.changed.has(
            doc.getArray(`slideMoves:${block.get("id")}`),
          ))
      )
        pending.add(block.get("id"));
    }
    if (!pending.size || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (disposed) return;
      const current = new Map(
        orderedBlocks(doc).map((block) => [block.get("id"), block]),
      );
      const edits = [...pending];
      pending.clear();
      doc.transact(() => {
        for (const id of edits) {
          const block = current.get(id);
          if (!block) continue;
          const key = `${encodeURIComponent(id)}:${doc.clientID}`;
          clock.set(key, Math.max(now(), (clock.get(key) ?? 0) + 1));
        }
      }, UPDATE_ORIGIN);
    });
  };
  doc.on("afterTransaction", changed);
  return () => {
    disposed = true;
    doc.off("afterTransaction", changed);
    pending.clear();
  };
}
