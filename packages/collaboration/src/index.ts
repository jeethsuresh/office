import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
export type ConnectionStatus =
  "connecting" | "synced" | "saving" | "offline" | "error";
export type User = { name: string; color: string };
const UPDATE = 0,
  AWARENESS = 1,
  READY = 2,
  ACK = 3,
  AWARENESS_REQUEST = 4;
const pendingLocalDocuments = new Map<string, Set<Y.Doc>>();

export class DocumentSession {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly persistence: IndexeddbPersistence;
  status: ConnectionStatus = "connecting";
  hydrated = false;
  error = "";
  private socket: WebSocket | null = null;
  private remoteState = new Y.Doc();
  private listeners = new Set<() => void>();
  private retry: ReturnType<typeof setTimeout> | undefined;
  private retries = 0;
  private disposed = false;
  private unloading = false;
  private pending = 0;
  private ready = false;
  private storageKey: string;
  constructor(
    readonly id: string,
    readonly baseURL: string,
    user: User,
    namespace = baseURL,
    observeOnly = false,
  ) {
    this.storageKey = `office:${namespace}:${id}`;
    for (const pending of pendingLocalDocuments.get(this.storageKey) ?? []) Y.applyUpdate(this.doc, Y.encodeStateAsUpdate(pending));
    this.persistence = new IndexeddbPersistence(this.storageKey, this.doc);
    if (observeOnly) this.awareness.setLocalState(null);
    else this.awareness.setLocalStateField("user", user);
    this.doc.on("update", this.onUpdate);
    this.awareness.on("update", this.onAwareness);
    this.awareness.on("change", this.emit);
    this.persistence.whenSynced
      .then(async () => {
        const openedBefore = await this.persistence.get("opened");
        if (!this.disposed) {
          this.hydrated = openedBefore === 1 || this.doc.store.clients.size > 0;
          this.emit();
          this.connect();
        }
      })
      .catch(() => {
        this.error = "Local storage is unavailable";
        this.connect();
      });
    window.addEventListener("online", this.onOnline);
    window.addEventListener("beforeunload", this.onUnload);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit = () => {
    if (!this.unloading) [...this.listeners].forEach((fn) => fn());
  };
  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.emit();
  }
  private send(type: number, data: Uint8Array) {
    if (this.socket?.readyState !== WebSocket.OPEN || !this.ready) return false;
    const frame = new Uint8Array(data.length + 1);
    frame[0] = type;
    frame.set(data, 1);
    this.socket.send(frame);
    return true;
  }
  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    if (this.send(UPDATE, update)) {
      this.pending++;
      this.setStatus("saving");
    } else if (this.hydrated) this.setStatus("offline");
  };
  private onAwareness = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin !== this)
      this.send(
        AWARENESS,
        encodeAwarenessUpdate(this.awareness, [
          ...added,
          ...updated,
          ...removed,
        ]),
      );
  };
  private onOnline = () => {
    if (this.status === "offline" || this.status === "error") {
      clearTimeout(this.retry);
      this.connect();
    }
  };
  private onUnload = () => {
    // Broadcast departure without updating React on the departing page.
    this.unloading = true;
    try {
      this.awareness.setLocalState(null);
    } finally {
      this.unloading = false;
    }
  };
  private connect() {
    if (
      this.disposed ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;
    if (!navigator.onLine) { this.setStatus("offline"); return; }
    this.setStatus("connecting");
    this.ready = false;
    this.pending = 0;
    this.remoteState.destroy();
    this.remoteState = new Y.Doc();
    const url = new URL(
      `/api/documents/${encodeURIComponent(this.id)}/ws`,
      this.baseURL,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.onmessage = (event) => {
      try {
        const frame = new Uint8Array(event.data as ArrayBuffer);
        const type = frame[0];
        const data = frame.subarray(1);
        if (type === UPDATE) {
          Y.applyUpdate(this.remoteState, data, this);
          Y.applyUpdate(this.doc, data, this);
        } else if (type === AWARENESS) {
          applyAwarenessUpdate(this.awareness, data, this);
        } else if (type === READY) {
          this.ready = true;
          this.hydrated = true;
          void this.persistence.set("opened", 1).catch(() => {});
          this.retries = 0;
          this.error = "";
          const local = Y.encodeStateAsUpdate(this.doc),
            remote = Y.encodeStateAsUpdate(this.remoteState);
          const changed =
            local.length !== remote.length ||
            local.some((byte, index) => byte !== remote[index]);
          if (changed) {
            this.send(
              UPDATE,
              Y.encodeStateAsUpdate(
                this.doc,
                Y.encodeStateVector(this.remoteState),
              ),
            );
            this.pending++;
          }
          this.send(
            AWARENESS,
            encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
          );
          this.setStatus(this.pending ? "saving" : "synced");
        } else if (type === ACK) {
          this.pending = Math.max(0, this.pending - 1);
          this.setStatus(this.pending ? "saving" : "synced");
        } else if (type === AWARENESS_REQUEST) {
          this.send(
            AWARENESS,
            encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
          );
        }
      } catch {
        this.error = "A collaboration update could not be read";
        this.setStatus("error");
        socket.close();
      }
    };
    socket.onerror = () => {
      this.error = "Cannot reach this workspace server";
    };
    socket.onclose = (event) => {
      if (this.disposed) return;
      this.ready = false;
      removeAwarenessStates(
        this.awareness,
        [...this.awareness.getStates().keys()].filter(
          (id) => id !== this.doc.clientID,
        ),
        this,
      );
      this.hydrated = this.hydrated || this.doc.store.clients.size > 0;
      this.setStatus("offline");
      if (event.code === 4401) {
        window.dispatchEvent(new Event("office:unauthorized"));
        return;
      }
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(1000 * 2 ** this.retries++, 15000),
      );
    };
  }
  setUser(user: User) {
    this.awareness.setLocalStateField("user", user);
  }
  setActiveBlock(id: string) {
    this.awareness.setLocalStateField("blockId", id);
  }
  destroy() {
    this.disposed = true;
    clearTimeout(this.retry);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("beforeunload", this.onUnload);
    this.awareness.setLocalState(null);
    this.socket?.close();
    this.doc.off("update", this.onUpdate);
    this.awareness.off("update", this.onAwareness);
    this.awareness.off("change", this.emit);
    this.awareness.destroy();
    void closePersistedDocument(this.doc, this.persistence, this.storageKey);
    this.remoteState.destroy();
    this.listeners.clear();
  }
}

// IndexedDB records the full initial snapshot before whenSynced resolves. A
// fast logout must let that snapshot commit before unsubscribing persistence.
export async function closePersistedDocument(doc: Y.Doc, persistence: { whenSynced: Promise<unknown>; destroy(): Promise<unknown> }, key = "") {
  let pending = pendingLocalDocuments.get(key);
  if (!pending) pendingLocalDocuments.set(key, pending = new Set());
  pending.add(doc);
  try {
    await persistence.whenSynced;
    await persistence.destroy();
    doc.destroy();
    pending.delete(doc);
    if (!pending.size) pendingLocalDocuments.delete(key);
  } catch {
    // Keep the document alive when storage fails; never discard its pending edits.
  }
}
