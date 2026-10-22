import { expect, test } from "bun:test";
import * as Y from "yjs";
import { closePersistedDocument } from "../../packages/collaboration/src";
test("logout while IndexedDB opens lets the unsent snapshot commit before document disposal", async () => {
  const doc = new Y.Doc();
  doc.getText("draft").insert(0, "Unsent before central logout");
  let initialized!: () => void, snapshot: Uint8Array | undefined, destroyed = false;
  const whenSynced = new Promise<void>(resolve => { initialized = () => { snapshot = Y.encodeStateAsUpdate(doc); resolve(); }; });
  const closed = closePersistedDocument(doc, { whenSynced, destroy: async () => { destroyed = true; } });
  expect(destroyed).toBe(false); expect(doc.isDestroyed).toBe(false);
  initialized(); await closed; expect(destroyed).toBe(true); expect(doc.isDestroyed).toBe(true);
  const recovered = new Y.Doc(); Y.applyUpdate(recovered, snapshot!); expect(recovered.getText("draft").toString()).toBe("Unsent before central logout"); recovered.destroy();
});
